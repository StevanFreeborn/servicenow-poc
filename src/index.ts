import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { validator } from "hono/validator";
import { z } from "zod";
import { serviceNow as sn } from "./serviceNow.js";
import { onspring as onx } from "./onspring.js";
import { isNotNullUndefinedOrWhitespace } from "./utils.js";
import { HTTPException } from "hono/http-exception";

const app = new Hono();

app.onError((error, _) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return new Response("Internal Server Error", {
    status: 500,
    statusText: "An unhandled error has occurred",
  });
});

app.get("/", (c) => {
  return c.json({ message: "Hello!" });
});

const syncRequestSchema = z.object({
  serviceNowBaseUrl: z.string().min(1).url(),
  appName: z.string().min(1),
  onspringUserAppId: z.number().min(1),
  onspringUserFirstNameFieldId: z.number().min(1),
  onspringUserLastNameFieldId: z.number().min(1),
  onspringUserUsernameFieldId: z.number().min(1),
  onspringUserEmailFieldId: z.number().min(1),
  onspringUserFullNameFieldId: z.number().min(1),
  onspringUserStatusFieldId: z.number().min(1),
  onspringUserTierFieldId: z.number().min(1),
  onspringRegTypeAppId: z.number().min(1),
  onspringRegTypeIdFieldId: z.number().min(1),
});

app.post(
  "/sync",
  basicAuth({
    verifyUser: (username, password, c) => {
      const onspringApiKey = c.req.header("x-apikey");
      return (
        isNotNullUndefinedOrWhitespace(username) &&
        isNotNullUndefinedOrWhitespace(password) &&
        isNotNullUndefinedOrWhitespace(onspringApiKey)
      );
    },
  }),
  validator("json", (value, c) => {
    const parsed = syncRequestSchema.safeParse(value);

    if (parsed.success === false) {
      return c.json({ error: parsed.error }, 400);
    }

    return parsed.data;
  }),
  async (c) => {
    try {
      const onspringApiKey = c.req.header("x-apikey")!;
      const authHeaderValue = c.req.header("Authorization")!;
      const body = c.req.valid("json");
      const serviceNow = sn({
        baseUrl: body.serviceNowBaseUrl,
        auth: authHeaderValue,
      });
      const onspring = onx({ apiKey: onspringApiKey });

      const serviceNowApp = await serviceNow.getAppByName(body.appName);
      const [serviceNowOwner, serviceNowL3] = await Promise.all([
        serviceNow.getUserByLink(serviceNowApp.u_primary_it_owner.link),
        serviceNow.getUserByLink(serviceNowApp.u_l3_name.link),
      ]);

      let [ownerRecordId, l3RecordId, ...regulatoryRecordIds] =
        await Promise.all([
          onspring.getRecordIdByFieldValue({
            appId: body.onspringUserAppId,
            fieldId: body.onspringUserFullNameFieldId,
            value: serviceNowOwner.name,
          }),
          onspring.getRecordIdByFieldValue({
            appId: body.onspringUserAppId,
            fieldId: body.onspringUserFullNameFieldId,
            value: serviceNowL3.name,
          }),
          ...serviceNowApp.u_regulatory_legal_and_compliance
            .split(",")
            .map((reg) => {
              return onspring.getRecordIdByFieldValue({
                appId: body.onspringRegTypeAppId,
                fieldId: body.onspringRegTypeIdFieldId,
                value: reg,
              });
            }),
        ]);

      if (ownerRecordId === 0) {
        ownerRecordId = await onspring.saveRecord({
          appId: body.onspringUserAppId,
          fields: {
            [body.onspringUserFirstNameFieldId]: serviceNowOwner.name.split(" ")[0],
            [body.onspringUserLastNameFieldId]: serviceNowOwner.name.split(" ")[1],
            [body.onspringUserUsernameFieldId]: serviceNowOwner.name.replace(" ", ".").toLowerCase(),
            [body.onspringUserEmailFieldId]: serviceNowOwner.name.replace(" ", ".").toLowerCase() + "@example.com",
            [body.onspringUserStatusFieldId]: "0fe6b5fb-7351-46e7-a833-5813f280f710",
            [body.onspringUserTierFieldId]: "19a961c2-661b-4132-91e5-623120ad59a8",
          },
        });
      }

      if (l3RecordId === 0) {
        l3RecordId = await onspring.saveRecord({
          appId: body.onspringUserAppId,
          fields: {
            [body.onspringUserFirstNameFieldId]: serviceNowL3.name.split(" ")[0],
            [body.onspringUserLastNameFieldId]: serviceNowL3.name.split(" ")[1],
            [body.onspringUserUsernameFieldId]: serviceNowL3.name.replace(" ", ".").toLowerCase(),
            [body.onspringUserEmailFieldId]: serviceNowL3.name.replace(" ", ".").toLowerCase() + "@example.com",
            [body.onspringUserStatusFieldId]: "0fe6b5fb-7351-46e7-a833-5813f280f710",
            [body.onspringUserTierFieldId]: "19a961c2-661b-4132-91e5-623120ad59a8",
          },
        });
      }

      const response = {
        appName: serviceNowApp.name,
        shortName: serviceNowApp.number,
        description: serviceNowApp.short_description,
        installType: serviceNowApp.install_type,
        cloudModel: serviceNowApp.u_cloud_model,
        owner: ownerRecordId,
        l3: l3RecordId,
        regulatory: regulatoryRecordIds.join("|"),
      };

      return c.json(response);
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPException(500, {
          message: "Internal Server Error",
          res: new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            statusText: "Internal Server Error",
            headers: {
              "Content-Type": "application/json",
            },
          }),
          cause: error,
        });
      }
    }
  },
);

const server = serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

for (const event of ["SIGINT", "SIGTERM"]) {
  process.on(event, () => {
    console.log(`Received ${event}, shutting down server`);
    server.close(() => {
      console.log("Server closed");
    });
  });
}

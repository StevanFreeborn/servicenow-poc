type ServiceNowApp = {
  number: string;
  short_description: string;
  u_l3_name: { link: string; value: string };
  u_cloud_model: string;
  it_application_owner: { link: string; value: string };
  name: string;
  u_primary_it_owner: { link: string; value: string };
  u_regulatory_legal_and_compliance: string;
  install_type: string;
};

type ServiceNowUser = {
  sys_id: string;
  sys_domain: { link: string; value: string };
  name: string;
  sys_class_name: string;
};

export function serviceNow({
  baseUrl,
  auth,
}: {
  baseUrl: string;
  auth: string;
}) {
  const authHeaderValue = auth;
  const serviceNowBaseUrl = baseUrl;
  const serviceNowHeaders = {
    Authorization: authHeaderValue,
  };

  return {
    async getAppByName(name: string): Promise<ServiceNowApp> {
      const appFields = [
        "name",
        "number",
        "u_primary_it_owner",
        "it_application_owner",
        "u_l3_name",
        "short_description",
        "u_regulatory_legal_and_compliance",
        "u_cloud_model",
        "install_type",
      ];

      const queryParams = new URLSearchParams({
        sysparm_fields: appFields.join(","),
        sysparm_query: `name=${name}`,
      });

      const serviceNowAppUrl = new URL(
        `/api/now/table/cmdb_ci_business_app?${queryParams.toString()}`,
        serviceNowBaseUrl,
      );

      const serviceNowAppResponse = await fetch(serviceNowAppUrl.toString(), {
        headers: serviceNowHeaders,
      });

      if (!serviceNowAppResponse.ok) {
        throw new Error(
          `Failed to fetch ServiceNow app with name ${name}: ${serviceNowAppResponse.statusText}`,
        );
      }

      const serviceNowAppResponseData = await serviceNowAppResponse.json();
      return serviceNowAppResponseData.result[0];
    },
    async getUserByLink(link: string): Promise<ServiceNowUser> {
      const userResponse = await fetch(link, { headers: serviceNowHeaders });

      if (!userResponse.ok) {
        throw new Error(
          `Failed to fetch user from ServiceNow: ${userResponse.statusText}`,
        );
      }

      const user = await userResponse.json();
      return user.result;
    },
  };
}

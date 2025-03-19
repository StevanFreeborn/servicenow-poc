export function onspring({ apiKey }: { apiKey: string }) {
  const onspringApiKey = apiKey;
  const baseUrl = "https://api.onspring.com";
  const headers = {
    "x-apikey": onspringApiKey,
    "Content-Type": "application/json",
  };

  return {
    async getRecordIdByFieldValue({
      appId,
      fieldId,
      value,
    }: {
      appId: number;
      fieldId: number;
      value: any;
    }): Promise<number> {
      const recordResponse = await fetch(
        `${baseUrl}/Records/Query`,
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            appId: appId,
            filter: `${fieldId} eq '${value}'`,
            fieldIds: [fieldId],
          }),
        },
      );

      if (!recordResponse.ok) {
        throw new Error(
          `Failed to fetch record with field ${fieldId} and value ${value}: ${recordResponse.statusText}`,
        );
      }

      const recordResponseData = await recordResponse.json();
      return recordResponseData?.items[0]?.recordId ?? 0;
    },
    async saveRecord({ appId, fields }: { appId: number; fields: object }): Promise<number> {
      const recordResponse = await fetch(
        `${baseUrl}/Records`,
        {
          method: "PUT",
          headers: headers,
          body: JSON.stringify({
            appId: appId,
            fields: fields,
          }),
        },
      );

      if (!recordResponse.ok) {
        throw new Error(
          `Failed to save record with fields ${JSON.stringify(fields)}: ${recordResponse.statusText}`,
        );
      }

      const recordResponseData = await recordResponse.json();
      return recordResponseData.id;
    },
  };
}

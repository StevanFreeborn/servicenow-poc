export function onspring({ apiKey }: { apiKey: string }) {
  const onspringApiKey = apiKey;

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
        "https://api.onspring.com/Records/Query",
        {
          method: "POST",
          headers: {
            "x-apikey": onspringApiKey,
            "Content-Type": "application/json",
          },
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
      return recordResponseData.items[0].recordId;
    },
  };
}

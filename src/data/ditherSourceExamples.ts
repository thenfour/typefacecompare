export type ExampleImage = {
  label: string;
  path: string;
};

export const DITHER_SOURCE_EXAMPLES_ENDPOINT = "/api/dither-source-examples";

export async function fetchDitherSourceExamples(): Promise<ExampleImage[]> {
  const response = await fetch(DITHER_SOURCE_EXAMPLES_ENDPOINT);
  if (!response.ok) {
    throw new Error("Unable to load example images");
  }
  const payload = (await response.json()) as ExampleImage[];
  return payload;
}

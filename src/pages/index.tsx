import Head from "next/head";
import { TypefaceComparisonTool } from "@/components/TypefaceComparisonTool";

export default function Home() {
  return (
    <>
      <Head>
        <title>typeface compare</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
        <TypefaceComparisonTool />
    </>
  );
}

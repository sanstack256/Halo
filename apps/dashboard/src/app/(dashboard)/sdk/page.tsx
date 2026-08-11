import { Halo } from "@halo-trace/sdk";

export default async function SdkPage() {
  const halo = new Halo({
    apiKey: "hl_live_83c633b628d2d060b4dea3f31c0953f59be324f7408dba6f30b610c5e8bdec92",
  });

  console.log(await halo.captureMessage("Hello Halo"));

  return (
    <div className="p-10 text-white">
      SDK Loaded Successfully
    </div>
  );
}
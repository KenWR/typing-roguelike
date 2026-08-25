import { createApp } from "./app.ts";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, host, () => {
  console.log(`API server listening on http://${host}:${port}`);
});

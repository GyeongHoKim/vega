/// <reference types="vite/client" />

declare module "*.raw?url" {
  const url: string;
  export default url;
}

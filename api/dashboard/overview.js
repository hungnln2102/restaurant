// Route tường minh: một số preset Vite trên Vercel không gắn catch-all `api/[...path].js`
// với mọi URL `/api/...`; entry này đảm bảo `/api/dashboard/overview` luôn có function.
export { default } from "../../backend/http/vercelApiGateway.mjs";

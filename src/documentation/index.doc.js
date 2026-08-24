import { Router } from "express";
import { serve, setup } from "swagger-ui-express";

const docrouter = Router();

const options = {
  openapi: "3.0.1",
  info: {
    title: "RWVCA Backend APIs",
    version: "1.0.0",
    description: "Rwanda Wood Value Chain Association REST API",
  },
  servers: [
    { url: "/api/v1", description: "API v1" },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Health", description: "Service health" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          200: {
            description: "API is running",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

docrouter.use("/", serve, setup(options));

export default docrouter;

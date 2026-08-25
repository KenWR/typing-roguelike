export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Typing Roguelike API",
    version: "0.0.0",
    description: "익명 게임 런의 진행 상태, 체크포인트, 종료 결과와 리더보드를 관리합니다.",
  },
  servers: [{ url: "http://localhost:3000", description: "로컬 개발 서버" }],
  tags: [
    { name: "System", description: "서버 상태" },
    { name: "Runs", description: "게임 런과 체크포인트" },
    { name: "Leaderboard", description: "점수 리더보드" },
  ],
  components: {
    securitySchemes: {
      anonymousPlayerCookie: {
        type: "apiKey",
        in: "cookie",
        name: "anonymous_player_id",
        description: "최초 API 요청에서 발급되는 HttpOnly 익명 사용자 쿠키",
      },
    },
    schemas: {
      RunState: {
        type: "object",
        required: ["schemaVersion", "character", "inventory", "loadout", "build", "map", "runCurrency"],
        properties: {
          schemaVersion: { type: "integer", example: 1 },
          character: { type: "object", additionalProperties: true },
          inventory: { type: "object", additionalProperties: true },
          loadout: { type: "object", additionalProperties: true },
          build: { type: "object", additionalProperties: true },
          map: {
            type: "object",
            required: ["mapId", "currentNodeId", "visitedNodeIds", "nodeStatuses"],
            properties: {
              mapId: { type: "string", example: "tower-v1" },
              currentNodeId: { type: "string", example: "node-2-1" },
              visitedNodeIds: { type: "array", items: { type: "string" } },
              nodeStatuses: { type: "object", additionalProperties: { type: "string" } },
            },
          },
          runCurrency: { type: "integer", minimum: 0, example: 120 },
        },
      },
      CheckpointRequest: {
        type: "object",
        required: ["nodeId", "floor", "stateVersion", "state"],
        properties: {
          nodeId: { type: "string", example: "node-2-1" },
          floor: { type: "integer", minimum: 0, example: 1 },
          stateVersion: { type: "integer", minimum: 1, example: 1 },
          state: { $ref: "#/components/schemas/RunState" },
        },
      },
      CompleteRunRequest: {
        type: "object",
        required: ["endReason", "score", "clearedFloor"],
        properties: {
          endReason: { type: "string", enum: ["dead", "cleared", "abandoned"] },
          score: { type: "integer", minimum: 0, example: 18450 },
          clearedFloor: { type: "integer", minimum: 0, example: 4 },
          accuracy: { type: "number", minimum: 0, maximum: 100, example: 94.5 },
          resultSnapshot: { type: "object", additionalProperties: true },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string", example: "run_not_found" } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "서버 상태 확인",
        responses: { "200": { description: "정상", content: { "application/json": { example: { status: "ok" } } } } },
      },
    },
    "/runs": {
      post: {
        tags: ["Runs"],
        summary: "새 게임 런 시작",
        security: [{ anonymousPlayerCookie: [] }],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object", properties: { nodeId: { type: "string", default: "start" } } } } },
        },
        responses: {
          "201": { description: "런 생성 및 첫 체크포인트 저장" },
          "409": { description: "활성 런이 이미 존재", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/runs/active": {
      get: {
        tags: ["Runs"],
        summary: "활성 런 조회",
        security: [{ anonymousPlayerCookie: [] }],
        responses: { "200": { description: "활성 런 또는 null" } },
      },
    },
    "/runs/{runId}/checkpoint": {
      put: {
        tags: ["Runs"],
        summary: "노드 진입 체크포인트 저장",
        security: [{ anonymousPlayerCookie: [] }],
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CheckpointRequest" } } } },
        responses: {
          "200": { description: "저장 성공" },
          "400": { description: "노드와 상태 불일치" },
          "404": { description: "런을 찾을 수 없음" },
          "409": { description: "오래된 stateVersion" },
        },
      },
    },
    "/runs/{runId}/complete": {
      post: {
        tags: ["Runs"],
        summary: "게임 런 종료 및 결과 저장",
        security: [{ anonymousPlayerCookie: [] }],
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CompleteRunRequest" } } } },
        responses: {
          "200": { description: "종료 결과 저장 성공" },
          "409": { description: "활성 런이 아니거나 이미 종료됨" },
        },
      },
    },
    "/leaderboard": {
      get: {
        tags: ["Leaderboard"],
        summary: "점수순 리더보드 조회",
        parameters: [{ name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }],
        responses: { "200": { description: "리더보드 목록" } },
      },
    },
  },
} as const;

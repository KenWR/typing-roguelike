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
        required: [
          "schemaVersion",
          "status",
          "character",
          "inventory",
          "loadout",
          "build",
          "map",
          "acquiredItemValue",
          "runCurrency",
        ],
        properties: {
          schemaVersion: { type: "integer", example: 1 },
          status: {
            type: "string",
            enum: ["active", "dead", "cleared", "abandoned"],
            example: "active",
          },
          character: {
            type: "object",
            required: ["currentHp", "maxHp"],
            properties: {
              currentHp: { type: "number", minimum: 0, example: 72 },
              maxHp: { type: "number", exclusiveMinimum: 0, example: 100 },
            },
          },
          inventory: {
            type: "object",
            required: ["itemInstances", "relicInstances"],
            properties: {
              itemInstances: { type: "array", items: { type: "string" } },
              relicInstances: { type: "array", items: { type: "string" } },
            },
          },
          loadout: {
            type: "object",
            required: ["weaponId", "subweaponId", "ring1Id", "ring2Id"],
            properties: {
              weaponId: { type: "string", nullable: true },
              subweaponId: { type: "string", nullable: true },
              ring1Id: { type: "string", nullable: true },
              ring2Id: { type: "string", nullable: true },
            },
          },
          build: {
            type: "object",
            required: ["equippedRelicIds"],
            properties: {
              equippedRelicIds: { type: "array", items: { type: "string" } },
            },
          },
          map: {
            type: "object",
            required: [
              "mapId",
              "seed",
              "currentNodeId",
              "currentRound",
              "choicePath",
              "nodeStatuses",
            ],
            properties: {
              mapId: { type: "string", example: "tower-v1" },
              seed: { type: "integer", example: 123456789 },
              currentNodeId: { type: "string", example: "2-1" },
              currentRound: { type: "integer", minimum: 1, example: 2 },
              choicePath: { type: "array", items: { type: "integer", minimum: 1, maximum: 3 }, example: [2, 1, 3] },
              nodeStatuses: { type: "object", additionalProperties: { type: "string" } },
            },
          },
          acquiredItemValue: { type: "integer", minimum: 0, example: 75 },
          runCurrency: { type: "integer", minimum: 0, example: 120 },
        },
      },
      CreateRunRequest: {
        type: "object",
        properties: {
          seed: { type: "integer", minimum: 0, description: "클라이언트 로컬 fallback과 동일한 맵을 재생성하기 위한 선택 seed" },
        },
      },
      CheckpointRequest: {
        type: "object",
        required: ["round", "choice", "stateVersion", "state"],
        properties: {
          round: { type: "integer", minimum: 1, example: 2 },
          choice: { type: "integer", enum: [1, 2, 3], example: 1 },
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
        requestBody: { required: false, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateRunRequest" } } } },
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
          "400": { description: "잘못된 종료 요청" },
          "404": { description: "런을 찾을 수 없음" },
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

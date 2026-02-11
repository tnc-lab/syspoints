const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Syspoints API',
      version: '1.0.0',
      description: 'Backend API for Syspoints',
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3000',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            wallet_address: { type: 'string' },
            email: { type: 'string', nullable: true },
            name: { type: 'string' },
            avatar_url: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            establishment_id: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            stars: { type: 'integer' },
            price: { type: 'number' },
            purchase_url: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            evidence_images: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'string', format: 'date-time' },
            points_awarded: { type: 'integer' },
            review_hash: { type: 'string' },
          },
        },
        PaginatedReviews: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Review' },
            },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                page_size: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
        LeaderboardEntry: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            avatar_url: { type: 'string' },
            total_points: { type: 'integer' },
          },
        },
        PaginatedLeaderboard: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/LeaderboardEntry' },
            },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                page_size: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

swaggerSpec.paths = {
  '/auth/nonce': {
    post: {
      summary: 'Issue login nonce',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              byWallet: {
                summary: 'By wallet_address',
                value: { wallet_address: '0x1234567890abcdef1234567890abcdef12345678' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Nonce issued' },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        404: {
          description: 'User not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/auth/token': {
    post: {
      summary: 'Issue JWT token',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              bySignature: {
                summary: 'By wallet signature',
                value: {
                  wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
                  signature: '0x...',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Token issued',
          content: {
            'application/json': {
              examples: {
                token: {
                  value: {
                    access_token: 'jwt',
                    token_type: 'Bearer',
                    expires_in: '1h',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        401: {
          description: 'Invalid signature or nonce',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/users': {
    post: {
      summary: 'Create user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              createUser: {
                value: {
                  wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
                  email: 'user@email.com',
                  name: 'User',
                  avatar_url: 'https://example.com/avatar.png',
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created' },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        409: {
          description: 'Conflict',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    get: {
      summary: 'List users',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/User' } },
              examples: {
                list: {
                  value: [
                    {
                      id: 'uuid',
                      wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
                      email: 'user@email.com',
                      name: 'User',
                      avatar_url: 'https://example.com/avatar.png',
                      created_at: '2026-02-09T12:00:00Z',
                    },
                  ],
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        403: {
          description: 'Forbidden',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/establishments': {
    get: {
      summary: 'List establishments',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'page_size', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              examples: {
                list: {
                  value: [
                    {
                      id: 'uuid',
                      name: 'Store',
                      category: 'restaurant',
                      created_at: '2026-02-09T12:00:00Z',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    post: {
      summary: 'Create establishment',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              createEstablishment: {
                value: { name: 'Store', category: 'restaurant' },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created' },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        403: {
          description: 'Forbidden',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/reviews': {
    get: {
      summary: 'List reviews',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'page_size', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'establishment_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'sort', in: 'query', schema: { type: 'string', enum: ['stars_desc'] } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedReviews' },
              examples: {
                page: {
                  value: {
                    data: [
                      {
                        id: 'uuid',
                        user_id: 'uuid',
                        establishment_id: 'uuid',
                        description: 'text...',
                        stars: 5,
                        price: 90.5,
                        purchase_url: 'https://example.com',
                        tags: ['tag1', 'tag2'],
                        evidence_images: ['https://example.com/image1.png'],
                        created_at: '2026-02-09T12:00:00Z',
                        points_awarded: 5,
                        review_hash: 'hash',
                      },
                    ],
                    meta: { page: 1, page_size: 20, total: 1 },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    post: {
      summary: 'Create review',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              createReview: {
                value: {
                  user_id: 'uuid',
                  establishment_id: 'uuid',
                  description: 'text...',
                  stars: 5,
                  price: 90.5,
                  purchase_url: 'https://example.com',
                  tags: ['tag1', 'tag2'],
                  evidence_images: ['https://example.com/image1.png'],
                },
              },
            },
          },
        },
      },
      responses: {
        201: { description: 'Created' },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        409: {
          description: 'Conflict',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/reviews/{id}': {
    get: {
      summary: 'Get review by id',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Review' },
              examples: {
                review: {
                  value: {
                    id: 'uuid',
                    user_id: 'uuid',
                    establishment_id: 'uuid',
                    description: 'text...',
                    stars: 5,
                    price: 90.5,
                    purchase_url: 'https://example.com',
                    tags: ['tag1', 'tag2'],
                    evidence_images: ['https://example.com/image1.png'],
                    created_at: '2026-02-09T12:00:00Z',
                    points_awarded: 5,
                    review_hash: 'hash',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/leaderboard': {
    get: {
      summary: 'Leaderboard',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'page_size', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedLeaderboard' },
              examples: {
                leaderboard: {
                  value: {
                    data: [
                      {
                        user_id: 'uuid',
                        name: 'User',
                        avatar_url: 'https://example.com/avatar.png',
                        total_points: 42,
                      },
                    ],
                    meta: { page: 1, page_size: 20, total: 1 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  '/admin/points-config': {
    get: {
      summary: 'Get points configuration',
      security: [{ BearerAuth: [] }],
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              examples: {
                config: {
                  value: {
                    image_points_yes: 1,
                    image_points_no: 0,
                    description_points_gt_200: 2,
                    description_points_lte_200: 1,
                    stars_points_yes: 1,
                    stars_points_no: 0,
                    price_points_lt_100: 1,
                    price_points_gte_100: 2
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        403: {
          description: 'Forbidden',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        }
      }
    },
    put: {
      summary: 'Update points configuration',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              config: {
                value: {
                  image_points_yes: 1,
                  image_points_no: 0,
                  description_points_gt_200: 2,
                  description_points_lte_200: 1,
                  stars_points_yes: 1,
                  stars_points_no: 0,
                  price_points_lt_100: 1,
                  price_points_gte_100: 2
                }
              }
            }
          }
        }
      },
      responses: {
        200: { description: 'OK' },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        403: {
          description: 'Forbidden',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        }
      }
    }
  },
  '/syscoin/review-hash': {
    post: {
      summary: 'Submit review hash to Syscoin',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            examples: {
              submit: {
                value: { review_id: '618cde23-e750-4f68-8f2a-b67c2460bebe' },
              },
            },
          },
        },
      },
      responses: {
        202: {
          description: 'Accepted',
          content: {
            'application/json': {
              examples: {
                accepted: {
                  value: {
                    review_id: 'uuid',
                    review_hash: 'hash',
                    user_wallet: '0x...',
                    establishment_id_hash: '0x...',
                    tx_hash: '0x...',
                    payload: {
                      review_id: 'uuid',
                      user_id: 'uuid',
                      establishment_id: 'uuid',
                      timestamp: '2026-02-09T12:00:00Z',
                      price: 90.5,
                    },
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        404: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  '/health': {
    get: {
      summary: 'Health check',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              examples: {
                ok: { value: { status: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  '/health/db': {
    get: {
      summary: 'Database health check',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              examples: {
                ok: { value: { status: 'ok', db: 'up' } },
              },
            },
          },
        },
        500: {
          description: 'DB down',
          content: {
            'application/json': {
              examples: {
                down: { value: { status: 'error', db: 'down' } },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = { swaggerSpec };

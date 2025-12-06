import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sim-Flow API',
      version: '1.0.0',
      description: 'Engineering Virtualization Portal API - Manage simulation requests, projects, and users',
      contact: {
        name: 'Sim-Flow Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login or /auth/sso/callback',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['Admin', 'Manager', 'Engineer', 'End-User'] },
            avatarUrl: { type: 'string', format: 'uri' },
          },
        },
        Request: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            vendor: { type: 'string' },
            status: {
              type: 'string',
              enum: [
                'Submitted',
                'Feasibility Review',
                'Resource Allocation',
                'Engineering Review',
                'Discussion',
                'In Progress',
                'Completed',
                'Revision Requested',
                'Accepted',
                'Denied',
              ],
            },
            priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            createdBy: { type: 'string', format: 'uuid' },
            createdByName: { type: 'string' },
            assignedTo: { type: 'string', format: 'uuid', nullable: true },
            assignedToName: { type: 'string', nullable: true },
            estimatedHours: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['Active', 'Completed', 'On Hold'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            requestId: { type: 'string', format: 'uuid' },
            authorId: { type: 'string', format: 'uuid' },
            authorName: { type: 'string' },
            authorRole: { type: 'string' },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string', description: 'JWT access token' },
            refreshToken: { type: 'string', description: 'Refresh token for obtaining new access tokens' },
          },
        },
        RefreshRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            userAgent: { type: 'string', nullable: true },
            ipAddress: { type: 'string', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Look for both JS and TS files (JS in Docker container, TS in local development)
  apis: ['./dist/routes/*.js', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

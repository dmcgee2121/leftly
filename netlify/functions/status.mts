export default async () => {
  return Response.json({
    status: 'ok',
    app: 'Leftly',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'unknown',
    deployContext: process.env.CONTEXT || 'unknown',
    timestamp: new Date().toISOString(),
  })
}

export const config = {
  path: '/api/status',
}

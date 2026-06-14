export default async () => {
  return Response.json({
    status: 'ok',
    app: 'Leftly',
    timestamp: new Date().toISOString(),
  })
}

export const config = {
  path: '/api/health',
}

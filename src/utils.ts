export const observerLambdaName = (id: string): string => `resolve-cloud-toolkit-observer-${id}`
export const observerRoleName = (id: string): string => `resolve-cloud-toolkit-observer-${id}`
export const observerEvent = (payload: any): object => ({
  name: 'scan',
  scheduling: 'manual',
  payload
})

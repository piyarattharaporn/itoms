export type AppEnvironment = 'production' | 'uat'

export const appEnvironment: AppEnvironment = import.meta.env.VITE_APP_ENV === 'uat' ? 'uat' : 'production'
export const isUatEnvironment = appEnvironment === 'uat'

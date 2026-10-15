export type Role = 'admin' | 'member'

export interface Org {
  id: string
  name: string
  defaultJurisdiction: string | null
}

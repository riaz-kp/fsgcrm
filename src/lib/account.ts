import { createContext, useContext } from 'react'

export interface Account {
  /** The username signed in with (or the email, for a login made before usernames). */
  login: string
  signOut: () => void
}

export const AccountContext = createContext<Account | null>(null)

/** The signed-in account, or null on sample data. */
export const useAccount = () => useContext(AccountContext)

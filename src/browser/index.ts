import { ReapitConnectBrowserSessionInitializers, ReapitConnectSession } from '../types'

import { Auth0Client, RedirectLoginResult } from '@auth0/auth0-spa-js'
import { sessionStorageCache } from './session-storage-cache'
import { idTokenToLoginIdentity } from './id-token'

type AppState = Partial<{
  internalRedirectPath: string
}>

export class ReapitConnectBrowserSession {
  public static readonly GLOBAL_KEY = '__REAPIT_MARKETPLACE_GLOBALS__'
  public static readonly REFRESH_TOKEN_KEY = 'REAPIT_REFRESH_TOKEN'
  public static readonly USER_NAME_KEY = 'REAPIT_LAST_AUTH_USER'
  public static readonly CODE_VERIFIER = 'REAPIT_CODE_VERIFIER'
  public static readonly STATE_NONCE = 'REAPIT_STATE_NONCE'
  public static readonly APP_DEFAULT_TIMEOUT = 10800000 // 3hrs in ms
  public connectInternalRedirect: string | null
  private auth0Client: Auth0Client
  private returnTo: string
  private redirect_uri: string
  private connectApplicationTimeout: number
  public isAuthenticated: boolean = false
  private idleTimeoutCountdown: number
  private forceRefetch: boolean = false

  constructor({
    connectClientId,
    connectOAuthUrl,
    connectLoginRedirectPath,
    connectLogoutRedirectPath,
    connectApplicationTimeout,
    usePKCE = true,
  }: ReapitConnectBrowserSessionInitializers) {
    if (!usePKCE) {
      console.info('PKCE requested to be disabled but is now always used.')
    }

    this.connectApplicationTimeout = connectApplicationTimeout ?? ReapitConnectBrowserSession.APP_DEFAULT_TIMEOUT
    this.idleTimeoutCountdown = this.connectApplicationTimeout
    this.redirect_uri = `${window.location.origin}${connectLoginRedirectPath || ''}`
    this.returnTo = `${window.location.origin}${
      connectLogoutRedirectPath || connectLogoutRedirectPath === '' ? connectLogoutRedirectPath : '/login'
    }`

    this.connectInternalRedirect = null
    this.auth0Client = new Auth0Client({
      clientId: connectClientId,
      domain: connectOAuthUrl,
      authorizationParams: {
        redirect_uri: this.redirect_uri,
      },
      useRefreshTokens: true,

      // use session storage provider if in AC, otherwise fall back to configured cache location
      cache: this.connectIsDesktop ? sessionStorageCache : undefined,
      cacheLocation: 'localstorage',
    })

    this.isAuthenticated = false

    this.connectBindPublicMethods()
    this.setIdleTimeoutListeners()
  }

  // I bind the public methods to the class on instantiation, in the case they are called in a new
  // closure - a good example of this behaviour is when we use the call effect in a saga
  private connectBindPublicMethods() {
    this.connectSession = this.connectSession.bind(this)
    this.connectAuthorizeRedirect = this.connectAuthorizeRedirect.bind(this)
    this.connectLoginRedirect = this.connectLoginRedirect.bind(this)
    this.connectLogoutRedirect = this.connectLogoutRedirect.bind(this)
    this.connectClearSession = this.connectClearSession.bind(this)
  }

  private setIdleTimeoutListeners() {
    if (this.connectIsDesktop) return

    const resetTimer = () => {
      clearTimeout(this.idleTimeoutCountdown)
      this.idleTimeoutCountdown = window.setTimeout(this.connectLogoutRedirect, this.connectApplicationTimeout)
    }

    document.onmousemove = resetTimer
    document.onkeypress = resetTimer
    document.ontouchstart = resetTimer
  }

  public get connectIsDesktop(): boolean {
    return Boolean(window[ReapitConnectBrowserSession.GLOBAL_KEY])
  }

  public get connectHasSession(): boolean {
    return this.isAuthenticated
  }

  public async connectAuthorizeRedirect(redirectUri?: string): Promise<void> {
    const params = new URLSearchParams(window.location.search)
    params.delete('code')
    const search = params ? `?${params.toString()}` : ''
    const internalRedirectPath = `${window.location.pathname}${search}`

    await this.auth0Client.loginWithRedirect({
      appState: {
        internalRedirectPath,
      },
      authorizationParams: {
        redirect_uri: redirectUri,
      },
    })
  }

  public connectLoginRedirect(redirectUri?: string): void {
    this.connectAuthorizeRedirect(redirectUri)
  }

  public connectLogoutRedirect(redirectUri?: string): void {
    this.auth0Client.logout({
      logoutParams: {
        returnTo: redirectUri || this.returnTo,
      },
    })
  }

  public connectClearSession(): void {
    this.forceRefetch = true
  }

  private async currentSession(): Promise<ReapitConnectSession | void> {
    if (!await this.auth0Client.isAuthenticated()) {
      throw new Error('unauthenticated')
    }

    const accessToken = await this.auth0Client.getTokenSilently({
      cacheMode: this.forceRefetch ? 'off' : 'on',
    })

    this.forceRefetch = false

    const idToken = await this.auth0Client.getIdTokenClaims()
    if (!idToken) {
      throw new Error('id token not present')
    }

    return {
      accessToken,
      idToken: idToken?.__raw,
      loginIdentity: idTokenToLoginIdentity(idToken),
      refreshToken: 'donotuse',
    }
  }

  private handledCodes: Record<string, Promise<RedirectLoginResult<AppState>>> = {}

  public async connectSession(): Promise<ReapitConnectSession | void> {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      if (!this.handledCodes[code]) {
        this.handledCodes[code] = this.auth0Client.handleRedirectCallback<AppState>()
      }

      const { appState } = await this.handledCodes[code]
      this.connectInternalRedirect = appState?.internalRedirectPath || null
    }

    try {
      const session = await this.currentSession()
      this.isAuthenticated = true
      return session
    } catch {
      this.isAuthenticated = false
      await this.connectAuthorizeRedirect()
    }
  }
}

const auth0ClientMock = jest.fn()
jest.doMock('@auth0/auth0-spa-js', () => ({
  Auth0Client: auth0ClientMock,
}))

const loginWithRedirect = jest.fn()
const logout = jest.fn()
const isAuthenticated = jest.fn()
const getTokenSilently = jest.fn()
const getIdTokenClaims = jest.fn()
const handleRedirectCallback = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()

  auth0ClientMock.mockReturnValue({
    loginWithRedirect,
    logout,
    isAuthenticated,
    getTokenSilently,
    getIdTokenClaims,
    handleRedirectCallback,
  })

  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      origin: 'http://example.org',
      href: 'http://example.org/app',
      pathname: '/app',
      search: 'code=something&else=asdfg',
    },
  })

  Object.defineProperty(window, ReapitConnectBrowserSession.GLOBAL_KEY, {
    value: undefined,
    writable: true,
  })

  jest.useFakeTimers()
  jest.spyOn(window, 'setTimeout')
})

import { ReapitConnectBrowserSession } from './browser'

const createSession = () => {
  const connectClientId = 'client-id'
  const connectOAuthUrl = 'oauth-url'
  const connectLoginRedirectPath = '/something'
  return new ReapitConnectBrowserSession({
    connectClientId,
    connectOAuthUrl,
    connectLoginRedirectPath,
  })
}

describe('connect-session browser', () => {
  it('should instantiate Auth0Client with the correct config', () => {
    createSession()

    expect(auth0ClientMock).toHaveBeenCalledWith({
      clientId: 'client-id',
      domain: 'oauth-url',
      authorizationParams: {
        redirect_uri: 'http://example.org/something',
      },
      useRefreshTokens: true,
      cache: undefined,
      cacheLocation: 'localstorage',
    })
  })

  it('should bind public methods', () => {
    const session = createSession()
    const ccs = session.connectClearSession
    // this will throw if unbound since this will be undefined so it can't set this.forceRefresh to true
    expect(() => ccs()).not.toThrow()
  })

  describe('idle timeout', () => {
    it('should reset the timer on interaction', () => {
      const session = createSession()

      document?.onmousemove?.({} as any)

      expect(window.setTimeout).toHaveBeenCalledWith(session.connectLogoutRedirect, 10800000)
    })

    it('should log the user out if timer ends', () => {
      createSession()
      document?.onmousemove?.({} as any)
      jest.runAllTimers()
      expect(window.location.href).toBe(
        'oauth-url/oidc/logout?post_logout_redirect_uri=http%3A%2F%2Fexample.org%2Flogin&client_id=client-id',
      )
    })
  })

  describe('connectIsDesktop', () => {
    it('should be true if window.__REAPIT_MARKETPLACE_GLOBALS__ exists', () => {
      window[ReapitConnectBrowserSession.GLOBAL_KEY] = 'something'
      const session = createSession()
      console.log('window[ReapitConnectBrowserSession.GLOBAL_KEY]', window[ReapitConnectBrowserSession.GLOBAL_KEY])
      expect(session.connectIsDesktop).toBe(true)
    })
    it('should be false if window.__REAPIT_MARKETPLACE_GLOBALS__ doesnt exist', () => {
      const session = createSession()
      expect(session.connectIsDesktop).toBe(false)
    })
  })

  describe('connectAuthorizeRedirect', () => {
    it('should call loginWithRedirect with appState internalRedirectPath being the current url minus the code param', async () => {
      const session = createSession()
      await session.connectAuthorizeRedirect()
      expect(loginWithRedirect.mock.calls[0][0].appState).toStrictEqual({
        internalRedirectPath: '/app?else=asdfg',
      })
    })
    it('should call loginWithRedirect with authorizationParams redirect_uri being the first argument if present', async () => {
      const session = createSession()
      await session.connectAuthorizeRedirect('redirect-uri')
      expect(loginWithRedirect.mock.calls[0][0].authorizationParams).toStrictEqual({
        redirect_uri: 'redirect-uri',
      })
      await session.connectAuthorizeRedirect()
      expect(loginWithRedirect.mock.calls[1][0].authorizationParams).toStrictEqual({
        redirect_uri: undefined,
      })
    })
  })

  describe('connectLoginRedirect', () => {
    it('should call loginWithRedirect with appState internalRedirectPath being the current url minus the code param', () => {
      const session = createSession()
      session.connectLoginRedirect()
      expect(loginWithRedirect.mock.calls[0][0].appState).toStrictEqual({
        internalRedirectPath: '/app?else=asdfg',
      })
    })
    it('should call loginWithRedirect with authorizationParams redirect_uri being the first argument if present', () => {
      const session = createSession()
      session.connectLoginRedirect('redirect-uri')
      expect(loginWithRedirect.mock.calls[0][0].authorizationParams).toStrictEqual({
        redirect_uri: 'redirect-uri',
      })
      session.connectLoginRedirect()
      expect(loginWithRedirect.mock.calls[1][0].authorizationParams).toStrictEqual({
        redirect_uri: undefined,
      })
    })
  })

  describe('connectLogoutRedirect', () => {
    it('should call logout and redirect the user to /oidc/logout with post_logout_redirect_uri and client_id', () => {
      const session = createSession()
      session.connectLogoutRedirect()
      expect(logout).toHaveBeenCalledWith({
        openUrl: false,
      })
      expect(window.location.href).toBe(
        'oauth-url/oidc/logout?post_logout_redirect_uri=http%3A%2F%2Fexample.org%2Flogin&client_id=client-id',
      )
    })

    it('should override post_logout_redirect_uri with the first arg', () => {
      const session = createSession()
      session.connectLogoutRedirect('somewhere')
      expect(window.location.href).toBe('oauth-url/oidc/logout?post_logout_redirect_uri=somewhere&client_id=client-id')
    })
  })

  describe('connectHasSession', () => {
    it('should false if the user has not previously authenticated', () => {
      expect(createSession().connectHasSession).toBe(false)
    })
  })

  describe('connectSession', () => {
    beforeEach(() => {
      handleRedirectCallback.mockResolvedValue({
        appState: {
          internalRedirectPath: 'internal-redirect-path',
        },
      })
    })

    describe('with code in the url', () => {
      it('should call handleRedirectCallback', async () => {
        const session = createSession()
        await session.connectSession()
        expect(handleRedirectCallback).toHaveBeenCalled()
      })

      it('should only call handleRedirectCallback once per code in the url', async () => {
        const session = createSession()
        await session.connectSession()
        await session.connectSession()
        expect(handleRedirectCallback).toHaveBeenCalledTimes(1)
      })

      it('should set the internalRedirectPath from the appState to connectInternalRedirect', async () => {
        const session = createSession()
        await session.connectSession()
        expect(session.connectInternalRedirect).toBe('internal-redirect-path')
      })
    })

    describe('without code in the url', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          writable: true,
          value: {
            origin: 'http://example.org',
            href: 'http://example.org/app',
            pathname: '/app',
            search: 'else=asdfg',
          },
        })
      })

      describe('authorized', () => {
        beforeEach(() => {
          isAuthenticated.mockResolvedValue(true)
          getTokenSilently.mockResolvedValue('access-token')
          getIdTokenClaims.mockResolvedValue({
            __raw: 'raw-id-token',
            name: 'name-from-token',
            email: 'email-address',
            'custom:reapit:agencyCloudId': 'agency-cloud-id',
            'custom:reapit:developerId': 'developer-id',
            'custom:reapit:clientCode': 'client-code',
            'custom:reapit:marketAdmin': 'market-admin',
            'custom:reapit:userCode': 'user-code',
            'cognito:groups': 'groups',
            'custom:reapit:orgName': 'org-name',
            'custom:reapit:orgId': 'org-id',
            'custom:reapit:offGroupIds': 'off-group-ids',
            'custom:reapit:offGrouping': 'true',
            'custom:reapit:offGroupName': 'off-group-name',
            'custom:reapit:officeId': 'office-id',
            'custom:reapit:orgProduct': 'org-product',
          })
        })

        it('should make connectHasSession return true', async () => {
          const session = createSession()
          await session.connectSession()
          expect(session.connectHasSession).toBe(true)
        })

        it('should return the token from getTokenSilently', async () => {
          const session = createSession()
          const cs = await session.connectSession()
          expect(cs).toBeDefined()
          if (cs) {
            expect(cs.accessToken).toBe('access-token')
          }
        })

        describe('connectClearSession', () => {
          it('should force the getTokenSilently cache off if connectClearSession was previously called', async () => {
            const session = createSession()
            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'on',
            })
            session.connectClearSession()

            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'off',
            })
          })

          it('should force the getTokenSilently cache on if connectClearSession was previously called and the token was then refetched', async () => {
            const session = createSession()
            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'on',
            })
            session.connectClearSession()

            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'off',
            })
            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'on',
            })

            await session.connectSession()
            expect(getTokenSilently).toHaveBeenLastCalledWith({
              cacheMode: 'on',
            })
          })
        })

        it('should return the raw id token from getIdTokenClaims', async () => {
          const session = createSession()
          const cs = await session.connectSession()
          expect(cs).toBeDefined()
          if (cs) {
            expect(cs.idToken).toBe('raw-id-token')
          }
        })

        it('should return the claims from the id token as the loginIdentity', async () => {
          const session = createSession()
          const cs = await session.connectSession()
          expect(cs).toBeDefined()
          if (cs) {
            expect(cs.loginIdentity).toStrictEqual({
              name: 'name-from-token',
              email: 'email-address',
              agencyCloudId: 'agency-cloud-id',
              developerId: 'developer-id',
              clientId: 'client-code',
              adminId: 'market-admin',
              userCode: 'user-code',
              groups: 'groups',
              orgName: 'org-name',
              orgId: 'org-id',
              offGroupIds: 'off-group-ids',
              offGrouping: true,
              offGroupName: 'off-group-name',
              officeId: 'office-id',
              orgProduct: 'org-product',
            })
          }
        })

        it('should return a refreshToken of "donotuse"', async () => {
          const session = createSession()
          const cs = await session.connectSession()
          expect(cs).toBeDefined()
          if (cs) {
            expect(cs.refreshToken).toBe('donotuse')
          }
        })
      })

      describe('unauthorized', () => {
        beforeEach(() => {
          isAuthenticated.mockResolvedValue(false)
        })
        it('should call connectAuthorizeRedirect()', async () => {
          const session = createSession()
          await session.connectSession()
          expect(loginWithRedirect).toHaveBeenCalled()
        })
        it('should make connectHasSession return false', async () => {
          const session = createSession()
          await session.connectSession()
          expect(session.connectHasSession).toBe(false)
        })
      })
    })
  })
})

import Store from 'electron-store';

interface TokenData {
  accessToken?: string;
  refreshToken?: string;
  userEmail?: string;
}

const store = new Store<TokenData>();

export const tokenStore = {
  getAccessToken: () => store.get('accessToken'),
  getRefreshToken: () => store.get('refreshToken'),
  setTokens: (accessToken: string, refreshToken: string, userEmail?: string) => {
    store.set('accessToken', accessToken);
    store.set('refreshToken', refreshToken);
    if (userEmail) store.set('userEmail', userEmail);
  },
  clear: () => store.clear(),
  getUserEmail: () => store.get('userEmail'),
};

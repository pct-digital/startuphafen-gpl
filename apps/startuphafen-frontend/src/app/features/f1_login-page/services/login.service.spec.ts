import { TestBed } from '@angular/core/testing';
import { TrpcService } from '@startuphafen/angular-common';
import { LoginService } from './login.service';

describe('LoginService', () => {
  let service: LoginService;
  let trpcClientMock: any;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    trpcClientMock = {
      Login: {
        loadRedirectHost: {
          query: jest.fn(),
        },
      },
      CMS: {
        getLoginText: {
          query: jest.fn(),
        },
      },
    };

    const trpcServiceMock = {
      client: trpcClientMock,
    } as any;

    TestBed.configureTestingModule({
      providers: [
        LoginService,
        { provide: TrpcService, useValue: trpcServiceMock },
      ],
    });

    service = TestBed.inject(LoginService);
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should log redirect host errors', async () => {
    const testError = new Error('Network error');
    trpcClientMock.Login.loadRedirectHost.query.mockRejectedValueOnce(
      testError
    );

    try {
      await service.getRedirectHost();
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });

  it('should log getText errors', async () => {
    const testError = new Error('CMS error');
    trpcClientMock.CMS.getLoginText.query.mockRejectedValueOnce(testError);

    try {
      await service.getText();
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
  });
});

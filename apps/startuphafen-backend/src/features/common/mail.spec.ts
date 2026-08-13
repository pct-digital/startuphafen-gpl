import { MailClient, MailConfig, MailDescription } from './mail';

const createTransportMock = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => createTransportMock(...args),
  },
}));

describe('MailClient', () => {
  const config: MailConfig = {
    host: 'mail.example.com',
    port: 587,
    user: 'sender@example.com',
    password: 'secret',
    from: 'sender@example.com',
  };

  const baseRequest: MailDescription = {
    to: 'recipient@example.com',
    cc: 'copy@example.com',
    subject: 'Test Subject',
    content: {
      type: 'text',
      data: 'Hello world',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns failed when SMTP rejects a recipient from the message envelope', async () => {
    const sendMailMock = jest.fn();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValueOnce({
      accepted: ['recipient@example.com'],
      rejected: ['copy@example.com'],
    });

    const client = new MailClient(config);
    const result = await client.sendMail(baseRequest);

    expect(result.success).toBe(false);
    expect(result.message).toContain('copy@example.com');
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('returns success when all recipients are accepted', async () => {
    const sendMailMock = jest.fn();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock
      .mockResolvedValueOnce({
        accepted: ['recipient@example.com', 'copy@example.com'],
        rejected: [],
      })
      .mockResolvedValueOnce({
        accepted: ['sender@example.com'],
        rejected: [],
      });

    const client = new MailClient(config);
    const result = await client.sendMail(baseRequest);

    expect(result).toEqual({
      success: true,
      message: 'Mail sent',
    });
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it('returns failed on transport errors', async () => {
    const sendMailMock = jest.fn();
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockRejectedValueOnce({
      name: 'Error',
      response: '550 rejected',
    });

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    const client = new MailClient(config);
    const result = await client.sendMail(baseRequest);

    expect(result).toEqual({
      success: false,
      message: '"550 rejected"',
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    consoleLogSpy.mockRestore();
  });
});

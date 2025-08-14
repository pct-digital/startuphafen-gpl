export async function resetTestMails(mailHost: string) {
  await fetch(mailHost + '/email/all', {
    method: 'DELETE',
  });
}

const _originalFetch = self.fetch;

export async function fetch(...args: Parameters<typeof _originalFetch>) {
  const request = new Request(args[0] as string, {
    credentials: "omit", // 기본값: 보안 유지
    ...args[1], // 사용자가 명시하면 덮어쓰기 허용
  });

  return _originalFetch(request);
}

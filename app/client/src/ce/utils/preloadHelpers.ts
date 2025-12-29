export const getBaseURL = () => {
  const publicUrl = process.env.PUBLIC_URL || "";

  return publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
};

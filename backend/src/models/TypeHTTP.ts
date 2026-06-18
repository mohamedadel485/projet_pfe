export const TypeHTTP = {
  head: "head",
  post: "post",
  put: "put",
  patch: "patch",
  delete: "delete",
  options: "options",
  get: "get",
} as const;

export type TypeHTTP = (typeof TypeHTTP)[keyof typeof TypeHTTP];

export default TypeHTTP;

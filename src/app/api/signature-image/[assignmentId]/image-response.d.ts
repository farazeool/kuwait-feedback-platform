declare module "@vercel/og" {
  // `@vercel/og` 1.0.0 publishes this type declaration:
  //
  //   export declare class ImageResponse {
  //     constructor(element: ReactElement, options?: ImageResponseOptions);
  //   }
  //
  // The class is declared with no `extends Response`, even though at runtime
  // its constructor returns `new Response(stream, { headers, status, statusText })`.
  // That missing `extends Response` breaks two things at the call site:
  //
  //   1. `.arrayBuffer()` (and the rest of `Body`) is not on the type, so reading
  //      the PNG bytes fails to type-check.
  //   2. `ImageResponse` is not assignable to `Response`, which Next.js' typed
  //      route handler signature returns (`Promise<Response | void> | Response | void`).
  //
  // We proper-class-merge the declaration to add `extends Response`. This is
  // the canonical fix for incomplete dependency types: the runtime class IS a
  // `Response` (it literally returns one from its constructor), the README
  // documents it as such, and the augmentation just makes the type match.
  //
  // The original class and the augmentation must agree on the constructor
  // signature for declaration merging to take effect, so we re-declare it
  // verbatim from `node_modules/@vercel/og/dist/og.d.ts`.
  export class ImageResponse extends Response {
    constructor(
      element: import("react").ReactElement,
      options?: import("@vercel/og").ImageResponseOptions,
    );
  }
}

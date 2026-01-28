import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/", "/sign-in", "/sign-up"],
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ["/api/health"],
  // After sign in, redirect to onboarding or dashboard
  afterAuth(auth, req) {
    // If user is signed in and accessing sign-in/sign-up, redirect to dashboard
    if (auth.userId && (req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up")) {
      const dashboard = new URL("/dashboard", req.url);
      return Response.redirect(dashboard);
    }
    // If user is not signed in and accessing protected route, redirect to sign-in
    if (!auth.userId && !auth.isPublicRoute) {
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("redirect_url", req.url);
      return Response.redirect(signIn);
    }
  },
});

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware
  // for more information about configuring your Middleware
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

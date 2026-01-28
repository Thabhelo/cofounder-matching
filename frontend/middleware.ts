import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Routes that can be accessed while signed out
  publicRoutes: ["/"],
  // Routes that can always be accessed, and have
  // no authentication information
  ignoredRoutes: ["/api/health"],
  // After sign in, redirect to onboarding or dashboard
  afterAuth(auth, req) {
    // If user is not signed in and accessing protected route, redirect to home page
    // The home page has modal-based sign-in/sign-up buttons (SignInButton/SignUpButton)
    if (!auth.userId && !auth.isPublicRoute) {
      const home = new URL("/", req.url);
      // Store the original URL in a query parameter so we can redirect after sign-in
      home.searchParams.set("redirect_url", req.url);
      return Response.redirect(home);
    }
  },
});

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware
  // for more information about configuring your Middleware
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

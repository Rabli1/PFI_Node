const sessionDurationSeconds = 20 * 60;

const AuthManager = {
    user: null,
    token: "",
    onTimeout: null,
    load() {
        const storedUser = localStorage.getItem("currentUser");
        const storedToken = localStorage.getItem("access_token");
        if (storedToken && storedUser) {
            try {
                this.user = JSON.parse(storedUser);
                this.token = storedToken;
                this.startTimer();
            } catch (error) {
                this.clear();
            }
        }
    },
    startTimer() {
        if (this.token) {
            initTimeout(sessionDurationSeconds, () => {
                this.clear();
                if (this.onTimeout) this.onTimeout();
            });
            timeout();
        }
    },
    setSession(tokenPayload) {
        this.user = tokenPayload.User;
        this.token = tokenPayload.Access_token;
        localStorage.setItem("currentUser", JSON.stringify(this.user));
        localStorage.setItem("access_token", this.token);
        this.startTimer();
    },
    clear() {
        this.user = null;
        this.token = "";
        localStorage.removeItem("currentUser");
        localStorage.removeItem("access_token");
        noTimeout();
    },
    isLoggedIn() { return this.user != null; },
    isAdmin() { return this.user && this.user.Authorizations && this.user.Authorizations.readAccess >= 3 && this.user.Authorizations.writeAccess >= 3; },
    isSuper() { return this.user && this.user.Authorizations && this.user.Authorizations.readAccess >= 2 && this.user.Authorizations.writeAccess >= 2; },
    canCreatePost() { return this.isSuper() || this.isAdmin(); },
    canManagePost(post) { return this.isAdmin() || (this.isSuper() && post && post.OwnerId === this.user.Id); },
    canLike() { return this.user && this.user.Authorizations && this.user.Authorizations.readAccess > 0; },
    roleLabel() {
        if (this.isAdmin()) return "Administrateur";
        if (this.isSuper()) return "Super usager";
        if (this.canLike()) return "Usager";
        return "Anonyme";
    }
};

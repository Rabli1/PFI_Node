class Accounts_API {
    static serverHost() { return Posts_API.serverHost(); }
    static ACCOUNTS_API_URL() { return this.serverHost() + "/api/accounts"; }
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
        this.lastResponse = null;
    }
    static authHeaders() {
        const headers = {};
        const token = (typeof AuthManager !== "undefined" && AuthManager.token) ? AuthManager.token : localStorage.getItem("access_token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return headers;
    }
    static setHttpErrorState(xhr) {
        this.lastResponse = xhr.responseJSON;
        if (xhr.responseJSON)
            this.currentHttpError = xhr.responseJSON.error_description || xhr.responseJSON.message || JSON.stringify(xhr.responseJSON);
        else
            this.currentHttpError = xhr.statusText == 'error' ? "Service introuvable" : xhr.statusText;
        this.currentStatus = xhr.status;
        this.error = true;
    }
    static conflictURL() { return this.serverHost() + "/accounts/conflict"; }
    static async login(credentials) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/token",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(credentials),
                success: data => { resolve(data); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async register(user) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/accounts/register",
                type: "POST",
                contentType: 'application/json',
                data: JSON.stringify(user),
                success: data => { resolve(data); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async verify(userId, code) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + `/accounts/verify?id=${userId}&code=${code}`,
                type: "GET",
                headers: this.authHeaders(),
                complete: data => { resolve(data.responseJSON); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async logout(userId = null) {
        this.initHttpState();
        let url = this.serverHost() + "/accounts/logout";
        if (userId) url += `?userId=${userId}`;
        return new Promise(resolve => {
            $.ajax({
                url,
                type: "GET",
                headers: this.authHeaders(),
                complete: data => { resolve(true); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(false); }
            });
        });
    }
    static async modify(user) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/accounts/modify",
                type: "PUT",
                contentType: 'application/json',
                headers: this.authHeaders(),
                data: JSON.stringify(user),
                success: data => { resolve(data); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async getUsers() {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL(),
                headers: this.authHeaders(),
                complete: data => { resolve(data.responseJSON); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async promote(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/accounts/promote",
                type: "POST",
                contentType: 'application/json',
                headers: this.authHeaders(),
                data: JSON.stringify({ Id: userId }),
                success: data => { resolve(data); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async toggleBlock(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/accounts/toggleblock",
                type: "POST",
                contentType: 'application/json',
                headers: this.authHeaders(),
                data: JSON.stringify({ Id: userId }),
                success: data => { resolve(data); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async delete(userId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.ACCOUNTS_API_URL() + "/" + userId,
                type: "DELETE",
                headers: this.authHeaders(),
                success: data => { resolve(true); },
                error: xhr => { this.setHttpErrorState(xhr); resolve(false); }
            });
        });
    }
}

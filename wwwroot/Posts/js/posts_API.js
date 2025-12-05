class Posts_API {
    static serverHost() {
         return window.location.origin;
    }
    static POSTS_API_URL() { return this.serverHost() + "/api/posts" };
    static initHttpState() {
        this.currentHttpError = "";
        this.currentStatus = 0;
        this.error = false;
        this.lastResponse = null;
    }
    static authHeaders() {
        const headers = {};
        const token = (typeof AuthManager !== 'undefined' && AuthManager.token) ? AuthManager.token : localStorage.getItem("access_token");
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
    static async HEAD() {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL(),
                type: 'HEAD',
                contentType: 'text/plain',
                headers: this.authHeaders(),
                complete: data => { resolve(data.getResponseHeader('ETag')); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Get(id = null) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + (id != null ? "/" + id : ""),
                headers: this.authHeaders(),
                complete: data => { resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON }); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async GetQuery(queryString = "") {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + queryString,
                headers: this.authHeaders(),
                complete: data => {
                    resolve({ ETag: data.getResponseHeader('ETag'), data: data.responseJSON });
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Save(data, create = true) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: create ? this.POSTS_API_URL() : this.POSTS_API_URL() + "/" + data.Id,
                type: create ? "POST" : "PUT",
                contentType: 'application/json',
                headers: this.authHeaders(),
                data: JSON.stringify(data),
                success: (data) => { resolve(data); },
                error: (xhr) => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
    static async Delete(id) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.POSTS_API_URL() + "/" + id,
                type: "DELETE",
                headers: this.authHeaders(),
                success: () => {
                    resolve(true);
                },
                error: (xhr) => {
                    Posts_API.setHttpErrorState(xhr); resolve(null);
                }
            });
        });
    }
    static async Like(postId) {
        this.initHttpState();
        return new Promise(resolve => {
            $.ajax({
                url: this.serverHost() + "/posts/like",
                type: "POST",
                contentType: 'application/json',
                headers: this.authHeaders(),
                data: JSON.stringify({ postId }),
                success: data => { resolve(data); },
                error: xhr => { Posts_API.setHttpErrorState(xhr); resolve(null); }
            });
        });
    }
}

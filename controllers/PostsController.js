import PostModel from '../models/post.js';
import Repository from '../models/repository.js';
import Controller from './Controller.js';
import AccessControl from '../accessControl.js';

export default class PostsController extends Controller {
    constructor(HttpContext) {
        super(HttpContext, new Repository(new PostModel()));
    }

    post(data) {
        if (!this.HttpContext.user)
            return this.HttpContext.response.unAuthorized("Connexion requise.");
        if (!AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.superUser()))
            return this.HttpContext.response.forbidden("Droits insuffisants pour creer une nouvelle.");
        data.UserId = this.HttpContext.user.Id;
        data.Likes = [];
        super.post(data);
    }

    put(data) {
        if (!this.HttpContext.user)
            return this.HttpContext.response.unAuthorized("Connexion requise.");
        const storedPost = this.repository.get(this.HttpContext.path.id, true);
        if (!storedPost)
            return this.HttpContext.response.notFound("Resource not found.");
        const isOwner = storedPost.UserId === this.HttpContext.user.Id;
        const isAdmin = AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin());
        if (!isOwner && !isAdmin)
            return this.HttpContext.response.forbidden("Droits insuffisants pour modifier cette nouvelle.");

        data.UserId = storedPost.UserId;
        data.Likes = storedPost.Likes ? storedPost.Likes : [];
        super.put(data);
    }

    remove(id) {
        if (!this.HttpContext.user)
            return this.HttpContext.response.unAuthorized("Connexion requise.");
        const storedPost = this.repository.get(id, true);
        if (!storedPost)
            return this.HttpContext.response.notFound("Resource not found.");
        const isOwner = storedPost.UserId === this.HttpContext.user.Id;
        const isAdmin = AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.admin());
        if (!isOwner && !isAdmin)
            return this.HttpContext.response.forbidden("Droits insuffisants pour effacer cette nouvelle.");

        super.remove(id);
    }

    like(data) {
        if (!AccessControl.writeGranted(this.HttpContext.authorizations, AccessControl.user()))
            return this.HttpContext.response.unAuthorized("Connexion requise pour aimer une nouvelle.");
        if (!data || !data.postId)
            return this.HttpContext.response.badRequest("postId est requis.");

        const post = this.repository.get(data.postId, true);
        if (!post)
            return this.HttpContext.response.notFound("Resource not found.");

        post.Likes = post.Likes ? post.Likes : [];
        const userId = this.HttpContext.user.Id;
        const likeIndex = post.Likes.indexOf(userId);
        if (likeIndex > -1)
            post.Likes.splice(likeIndex, 1);
        else
            post.Likes.push(userId);

        const updated = this.repository.update(post.Id, post, false);
        if (this.repository.model.state.isValid)
            this.HttpContext.response.JSON(this.repository.get(updated.Id));
        else
            this.HttpContext.response.badRequest(this.repository.model.state.errors);
    }
}

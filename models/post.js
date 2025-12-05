import Model from './model.js';
import Repository from './repository.js';
import User from './user.js';

export default class Post extends Model {
    constructor() {
        super(true /* secured Id */);

        this.addField('Title', 'string');
        this.addField('Text', 'string');
        this.addField('Category', 'string');
        this.addField('Image', 'asset');
        this.addField('Date', 'integer');
        this.addField('UserId', 'string');
        this.addField('Likes', 'array');

        this.setKey("Title");
    }

    bindExtraData(post) {
        const usersRepository = new Repository(new User());
        post.Likes = post.Likes ? post.Likes : [];
        post.UserId = post.UserId ? post.UserId : "";

        const owner = post.UserId ? usersRepository.get(post.UserId) : null;
        post.OwnerId = post.UserId;
        post.OwnerName = owner ? owner.Name : "Anonyme";

        const likedByNames = [];
        post.Likes.forEach(userId => {
            const user = usersRepository.get(userId);
            if (user)
                likedByNames.push(user.Name);
        });
        post.LikedBy = likedByNames;
        post.LikesCount = likedByNames.length;
        return post;
    }
}

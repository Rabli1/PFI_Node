////// Posts SPA with authentication, likes and admin tools
////// Nicolas Chourot - adapted

const periodicRefreshPeriod = 10;
const waitingGifTrigger = 2000;
const minKeywordLenth = 3;
const keywordsOnchangeDelay = 500;

let categories = [];
let selectedCategory = "";
let currentETag = "";
let periodic_Refresh_paused = false;
let postsPanel;
let waiting = null;
let showKeywords = false;
let keywordsOnchangeTimger = null;
let verifyingUserId = null;

Init_UI();
async function Init_UI() {
    AuthManager.onTimeout = handleSessionTimeout;
    AuthManager.load();
    AuthManager.clear();

    postsPanel = new PageManager('postsScrollPanel', 'postsPanel', 'postSample', renderPosts);
    $('#createPost').on("click", async function () {
        if (AuthManager.canCreatePost())
            showCreatePostForm();
        else
            showLoginForm();
    });
    $(document).on("click keydown", function () {
        if (AuthManager.isLoggedIn()) timeout();
    });
    $('#abort').on("click", async function () {
        await showPosts();
    });
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $("#showSearch").on('click', function () {
        toggleShowKeywords();
        showPosts(true);
    });

    installKeywordsOnkeyupEvent();
    refreshHeader();
    updateDropDownMenu();
    await showPosts();
    start_Periodic_Refresh();

    /* determine if elem is in viewport */
    $.fn.isInViewport = function () { /* insert a new method to jquery sizzle */
        var elementTop = $(this).offset().top;
        var elementBottom = elementTop + $(this).outerHeight();

        var viewportTop = $(window).scrollTop();
        var viewportBottom = viewportTop + $(window).height();

        return elementBottom > viewportTop && elementTop < viewportBottom;
    };
}

/////////////////////////// Search keywords UI //////////////////////////////////////////////////////////

function installKeywordsOnkeyupEvent() {
    $("#searchKeys").on('keyup', function () {
        clearTimeout(keywordsOnchangeTimger);
        /* Delay search by keywordsOnchangeDelay seconds in order to limit requests to server */
        keywordsOnchangeTimger = setTimeout(() => {
            cleanSearchKeywords();
            showPosts(true);
        }, keywordsOnchangeDelay);
    });
    $("#searchKeys").on('search', function () {
        showPosts(true);
    });
}
function cleanSearchKeywords() {
    /* Keep only keywords of 3 characters or more */
    let keywords = $("#searchKeys").val().trim().split(' ');
    let cleanedKeywords = "";
    keywords.forEach(keyword => {
        if (keyword.length >= minKeywordLenth) cleanedKeywords += keyword + " ";
    });
    $("#searchKeys").val(cleanedKeywords.trim());
}
function showSearchIcon() {
    $("#showSearch").show();
    if (showKeywords)
        $("#searchKeys").show();
    else
        $("#searchKeys").hide();
}
function hideSearchIcon() {
    $("#showSearch").hide();
    $("#searchKeys").hide();
}
function toggleShowKeywords() {
    showKeywords = !showKeywords;
    if (showKeywords) {
        $("#searchKeys").show();
        $("#searchKeys").focus();
    }
    else {
        $("#searchKeys").hide();
        showPosts(true);
    }
}

/////////////////////////// Views management ////////////////////////////////////////////////////////////

function refreshHeader() {
    if (AuthManager.isLoggedIn())
        $("#createPost").show();
    else
        $("#createPost").hide();
}
function intialView() {
    refreshHeader();
    $('#menu').show();
    $('#commit').hide();
    $('#abort').hide();
    $('#form').hide();
    $('#form').empty();
    $('#aboutContainer').hide();
    $('#errorContainer').hide();
    $("#createPost").show();

    showSearchIcon();
}
async function showPosts(reset = false) {
    intialView();
    $("#viewTitle").text("Fil de nouvelles");
    periodic_Refresh_paused = false;
    await postsPanel.show(reset);
}
function hidePosts() {
    postsPanel.hide();
    hideSearchIcon();
    $("#createPost").hide();
    $('#menu').show();
    periodic_Refresh_paused = true;
}
function showForm(title = "") {
    hidePosts();
    $('#form').show();
    $('#abort').show();
    if (title !== "")
        $("#viewTitle").text(title);
}
function showError(message) {
    periodic_Refresh_paused = true;
    popupMessage(message);
}
function showCreatePostForm() {
    showForm("Ajout");
    $('#commit').show();
    renderPostForm();
}
function showEditPostForm(id) {
    showForm("Modification");
    $('#commit').show();
    renderEditPostForm(id);
}
function showDeletePostForm(id) {
    showForm("Retrait");
    $('#commit').hide();
    renderDeletePostForm(id);
}
function showAbout() {
    hidePosts();
    $('#commit').hide();
    $('#abort').show();
    $("#viewTitle").text("A propos...");
    $("#aboutContainer").show();
}

//////////////////////////// Posts rendering /////////////////////////////////////////////////////////////

function start_Periodic_Refresh() {

    setInterval(async () => {
        if (!periodic_Refresh_paused) {
            updateVisiblePosts();
            let etag = await Posts_API.HEAD();
            if (currentETag != etag)
                currentETag = etag;
        }
    },
        periodicRefreshPeriod * 1000);
}

function updateVisiblePosts() {
    $('.post').each(async function () {
        if ($(this).isInViewport()) {
            updatePost($(this).attr('id'));
        }
    })
    compileCategories();
}

async function updatePost(postId) {
    let postElem = $(`.post[id=${postId}]`);
    let response = await Posts_API.Get(postId);
    if (!Posts_API.error && response && response.data) {
        let post = response.data;
        let wasExtended = $(`.postTextContainer[postid=${postId}]`).hasClass("showExtra");
        postElem.replaceWith(renderPost(post));
        if (wasExtended) {
            $(`.postTextContainer[postid=${postId}]`).addClass('showExtra');
            $(`.postTextContainer[postid=${postId}]`).removeClass('hideExtra');
            $(`.moreText[postid=${postId}]`).hide();
            $(`.lessText[postid=${postId}]`).show();
        }
    }
    linefeeds_to_Html_br(".postText");
    highlightKeywords();
    attach_Posts_UI_Events_Callback();
}
async function renderPosts(container, queryString) {
    addWaitingGif();

    let endOfData = false;
    queryString += "&sort=-date";
    compileCategories();
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    if (showKeywords) {
        let keys = $("#searchKeys").val().replace(/[ ]/g, ',');
        if (keys !== "")
            queryString += "&keywords=" + $("#searchKeys").val().replace(/[ ]/g, ',')
    }
    let response = await Posts_API.GetQuery(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                container.append(renderPost(Post));
            });
        } else
            endOfData = true;
        linefeeds_to_Html_br(".postText");
        highlightKeywords();
        attach_Posts_UI_Events_Callback();
    } else {
        if (Posts_API.currentStatus == 401 || Posts_API.currentStatus == 403)
            handleSessionTimeout();
        else
            showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function renderPost(post) {
    let date = convertToFrenchDate(UTC_To_Local(post.Date));
    const canEdit = AuthManager.canManagePost(post);
    const userLiked = AuthManager.isLoggedIn() && post.Likes && AuthManager.user && post.Likes.includes(AuthManager.user.Id);
    const likeIconClass = userLiked ? "fa-solid fa-thumbs-up liked" : "fa-regular fa-thumbs-up";
    const likeTitle = post.LikedBy && post.LikedBy.length > 0 ? post.LikedBy.join(', ') : "Aucun like";
    const likeDisabledClass = AuthManager.canLike() ? "" : "disabled";

    return $(
        `<div class="post" id="${post.Id}" etag="${currentETag}">
            <div class="postHeader">
                <div>
                    ${post.Category} • <span class="postOwner">${post.OwnerName}</span>
                </div>
                <div class="postActions">
                    ${canEdit ? `<span class="editCmd cmdIconSmall fa fa-pencil" postId="${post.Id}" title="Modifier nouvelle"></span>` : ""}
                    ${canEdit ? `<span class="deleteCmd cmdIconSmall fa fa-trash" postId="${post.Id}" title="Effacer nouvelle"></span>` : ""}
                    <span class="likeArea" title="${likeTitle}">
                        <span class="likeCmd ${likeDisabledClass}" postId="${post.Id}">
                            <i class="${likeIconClass}"></i> <span class="likeCount">${post.LikesCount}</span>
                        </span>
                    </span>
                </div>
            </div>
            <div class="postTitle"> ${post.Title} </div>
            <img class="postImage" src='${post.Image}'/>
            <div class="postDate"> ${date} </div>
            <div postId="${post.Id}" class="postTextContainer hideExtra">
                <div class="postText" >${post.Text}</div>
            </div>
           
            <div class="postfooter">
                <span postId="${post.Id}" class="moreText cmdIconXSmall fa fa-angle-double-down" title="Afficher la suite"></span>
                <span postId="${post.Id}" class="lessText cmdIconXSmall fa fa-angle-double-up" title="Raccourcir"></span>
            </div>         
        </div>`
    );
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            if (!categories.includes(selectedCategory))
                selectedCategory = "";
            updateDropDownMenu(categories);
        }
    }
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();

    if (AuthManager.isLoggedIn()) {
        DDMenu.append(`
            <div class="dropdown-item menuItemLayout disabled">
                <i class="menuIcon fa fa-user mx-2"></i> ${AuthManager.user.Name} (${AuthManager.roleLabel()})
            </div>`);
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
        DDMenu.append(`
            <div class="dropdown-item menuItemLayout" id="profileCmd">
                <i class="menuIcon fa fa-id-card mx-2"></i> Mon profil
            </div>`);
        if (AuthManager.isAdmin()) {
            DDMenu.append(`
                <div class="dropdown-item menuItemLayout" id="usersAdminCmd">
                    <i class="menuIcon fa fa-users-gear mx-2"></i> Gestion des usagers
                </div>`);
        }
        DDMenu.append(`
            <div class="dropdown-item menuItemLayout" id="logoutCmd">
                <i class="menuIcon fa fa-right-from-bracket mx-2"></i> Deconnexion
            </div>`);
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
    } else {
        DDMenu.append(`
            <div class="dropdown-item menuItemLayout" id="loginCmd">
                <i class="menuIcon fa fa-right-to-bracket mx-2"></i> Connexion
            </div>`);
        DDMenu.append(`
            <div class="dropdown-item menuItemLayout" id="registerCmd">
                <i class="menuIcon fa fa-user-plus mx-2"></i> Inscription
            </div>`);
        DDMenu.append($(`<div class="dropdown-divider"></div>`));
    }

    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les categories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> A propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        showAbout();
    });
    $('#allCatCmd').on("click", async function () {
        selectedCategory = "";
        await showPosts(true);
        updateDropDownMenu();
    });
    $('.category').on("click", async function () {
        selectedCategory = $(this).text().trim();
        await showPosts(true);
        updateDropDownMenu();
    });
    $('#loginCmd').on("click", function () { showLoginForm(); });
    $('#registerCmd').on("click", function () { showRegisterForm(); });
    $('#profileCmd').on("click", function () { showProfileForm(); });
    $('#logoutCmd').on("click", function () { logout(); });
    $('#usersAdminCmd').on("click", function () { showUsersAdmin(); });
}

function attach_Posts_UI_Events_Callback() {

    linefeeds_to_Html_br(".postText");

    // attach icon command click event callback
    $(".editCmd").off();
    $(".editCmd").on("click", function () {
        showEditPostForm($(this).attr("postId"));
    });
    $(".deleteCmd").off();
    $(".deleteCmd").on("click", function () {
        showDeletePostForm($(this).attr("postId"));
    });
    $(".moreText").off();
    $(".moreText").click(function () {
        $(`.lessText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('showExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('hideExtra');
    })
    $(".lessText").off();
    $(".lessText").click(function () {
        $(`.moreText[postId=${$(this).attr("postId")}]`).show();
        $(this).hide();
        postsPanel.scrollToElem($(this).attr("postId"));
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).addClass('hideExtra');
        $(`.postTextContainer[postId=${$(this).attr("postId")}]`).removeClass('showExtra');
    })
    $(".likeCmd").off();
    $(".likeCmd").on("click", async function () {
        let postId = $(this).attr("postId");
        await toggleLike(postId);
    });
}
async function toggleLike(postId) {
    if (!AuthManager.canLike()) {
        showLoginForm();
        return;
    }
    timeout();
    await Posts_API.Like(postId);
    if (!Posts_API.error)
        updatePost(postId);
    else {
        if (Posts_API.currentStatus == 401 || Posts_API.currentStatus == 403)
            handleSessionTimeout();
        else
            showError(Posts_API.currentHttpError);
    }
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        postsPanel.itemsPanel.append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}

/////////////////////// Posts content manipulation ///////////////////////////////////////////////////////

function linefeeds_to_Html_br(selector) {
    $.each($(selector), function () {
        let postText = $(this);
        var str = postText.html();
        var regex = /[\r\n]/g;
        postText.html(str.replace(regex, "<br>"));
    })
}
function highlight(text, elem) {
    text = text.trim();
    if (text.length >= minKeywordLenth) {
        var innerHTML = elem.innerHTML;
        let startIndex = 0;

        while (startIndex < innerHTML.length) {
            var normalizedHtml = innerHTML.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var index = normalizedHtml.indexOf(text, startIndex);
            let highLightedText = "";
            if (index >= startIndex) {
                highLightedText = "<span class='highlight'>" + innerHTML.substring(index, index + text.length) + "</span>";
                innerHTML = innerHTML.substring(0, index) + highLightedText + innerHTML.substring(index + text.length);
                startIndex = index + highLightedText.length + 1;
            } else
                startIndex = innerHTML.length + 1;
        }
        elem.innerHTML = innerHTML;
    }
}
function highlightKeywords() {
    if (showKeywords) {
        let keywords = $("#searchKeys").val().split(' ');
        if (keywords.length > 0) {
            keywords.forEach(key => {
                let titles = document.getElementsByClassName('postTitle');
                Array.from(titles).forEach(title => {
                    highlight(key, title);
                })
                let texts = document.getElementsByClassName('postText');
                Array.from(texts).forEach(text => {
                    highlight(key, text);
                })
            })
        }
    }
}

//////////////////////// Forms rendering /////////////////////////////////////////////////////////////////

async function renderEditPostForm(id) {
    $('#commit').show();
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            showError("Post introuvable!");
    } else {
        showError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let post = response.data;
        if (post !== null) {
            let date = convertToFrenchDate(UTC_To_Local(post.Date));
            $("#form").append(`
                <div class="post" id="${post.Id}">
                <div class="postHeader">  ${post.Category} </div>
                <div class="postTitle ellipsis"> ${post.Title} </div>
                <img class="postImage" src='${post.Image}'/>
                <div class="postDate"> ${date} </div>
                <div class="postTextContainer showExtra">
                    <div class="postText">${post.Text}</div>
                </div>
            `);
            linefeeds_to_Html_br(".postText");
            // attach form buttons click event callback
            $('#commit').on("click", async function () {
                await Posts_API.Delete(post.Id);
                if (!Posts_API.error) {
                    await showPosts(true);
                }
                else {
                    showError(Posts_API.currentHttpError);
                }
            });
            $('#cancel').on("click", async function () {
                await showPosts();
            });

        } else {
            showError("Post introuvable!");
        }
    } else
        showError(Posts_API.currentHttpError);
}
function newPost() {
    let Post = {};
    Post.Id = 0;
    Post.Title = "";
    Post.Text = "";
    Post.Image = "news-logo-upload.png";
    Post.Category = "";
    return Post;
}
function renderPostForm(post = null) {
    if (!AuthManager.isLoggedIn()) {
        showLoginForm();
        return;
    }
    timeout();
    let create = post == null;
    if (create) post = newPost();
    $("#form").show();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="postForm">
            <input type="hidden" name="Id" value="${post.Id}"/>
             <input type="hidden" name="Date" value="${post.Date}"/>
            <label for="Category" class="form-label">Categorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Categorie"
                required
                value="${post.Category}"
            />
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractere illegal"
                value="${post.Title}"
            />
            <label for="Url" class="form-label">Texte</label>
             <textarea class="form-control" 
                          name="Text" 
                          id="Text"
                          placeholder="Texte" 
                          rows="9"
                          required 
                          RequireMessage = 'Veuillez entrer une Description'>${post.Text}</textarea>

            <label class="form-label">Image </label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='${create}' 
                     controlId='Image' 
                     imageSrc='${post.Image}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div id="keepDateControl">
                <input type="checkbox" name="keepDate" id="keepDate" class="checkbox" checked>
                <label for="keepDate"> Conserver la date de creation </label>
            </div>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary displayNone">
        </form>
    `);
    if (create) $("#keepDateControl").hide();

    initImageUploaders();
    initFormValidation(); // important do to after all html injection!

    $("#commit").off();
    $("#commit").show();
    $("#commit").click(function () {
        $("#commit").off();
        return $('#savePost').trigger("click");
    });
    $('#postForm').on("submit", async function (event) {
        event.preventDefault();
        let post = getFormData($("#postForm"));
        if (post.Category != selectedCategory)
            selectedCategory = "";
        if (create || !('keepDate' in post))
            post.Date = Local_to_UTC(Date.now());
        delete post.keepDate;
        post = await Posts_API.Save(post, create);
        if (!Posts_API.error) {
            await showPosts(true);
            postsPanel.scrollToElem(post.Id);
        }
        else
            showError(Posts_API.currentHttpError);
    });
    $('#cancel').on("click", async function () {
        await showPosts();
    });
}
function getFormData($form) {
    // prevent html injections
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    // grab data from all controls
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    return jsonObject;
}

//////////////////////// Authentication and accounts /////////////////////////////////////////////////////

function handleSessionTimeout() {
    logout(false);
    popupMessage("Session expiree. Veuillez vous reconnecter.");
    showLoginForm();
}
async function logout(callServer = true) {
    if (callServer && AuthManager.isLoggedIn())
        await Accounts_API.logout(AuthManager.user.Id);
    AuthManager.clear();
    refreshHeader();
    updateDropDownMenu();
    await showPosts(true);
}
function showLoginForm() {
    showForm("Connexion");
    $('#commit').hide();
    $("#form").empty();
    $("#form").append(`
        <form class="form loginForm" id="loginForm">
            <div id="formError" class="errorContainer" style="display:none;"></div>
            <label for="Email" class="form-label">Courriel</label>
            <input class="form-control Email" name="Email" id="Email" placeholder="Courriel" required />
            <label for="Password" class="form-label">Mot de passe</label>
            <input class="form-control" type="password" name="Password" id="Password" placeholder="Mot de passe" required />
            <div class="formButton">
                <button type="submit" class="btn btn-primary w-100">Connexion</button>
            </div>
            <div class="formButton">
                <button type="button" id="gotoRegister" class="btn btn-secondary w-100">Inscription</button>
            </div>
        </form>
    `);
    $('#gotoRegister').on("click", function () { showRegisterForm(); });
    $('#loginForm').on("submit", async function (event) {
        event.preventDefault();
        let credentials = getFormData($("#loginForm"));
        let token = await Accounts_API.login(credentials);
        if (!Accounts_API.error && token) {
            AuthManager.setSession(token);
            updateDropDownMenu();
            await showPosts(true);
        } else {
            let message = Accounts_API.currentHttpError;
            switch (Accounts_API.currentStatus) {
                case 0: message = "Le serveur ne repond pas"; break;
                case 481: message = "Courriel d'utilisateur introuvable"; break;
                case 482: message = "Mot de passe incorrect"; break;
                case 405: message = "Compte bloque par l'administrateur"; break;
                case 480:
                    verifyingUserId = Accounts_API.lastResponse ? Accounts_API.lastResponse.userId : null;
                    showVerifyForm(verifyingUserId, credentials.Email);
                    return;
            }
            $("#formError").text(message);
            $("#formError").show();
        }
    });
}
function showRegisterForm() {
    showForm("Inscription");
    $('#commit').hide();
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="registerForm">
            <div id="formError" class="errorContainer" style="display:none;"></div>
            <input type="hidden" name="Id" value="0"/>
            <label for="Name" class="form-label">Nom complet</label>
            <input class="form-control Alpha" name="Name" id="Name" placeholder="Nom" required />
            <label for="Email" class="form-label">Courriel</label>
            <input class="form-control Email" name="Email" id="Email" placeholder="Courriel" required CustomErrorMessage="Ce courriel existe deja" />
            <label for="Password" class="form-label">Mot de passe</label>
            <input class="form-control" type="password" name="Password" id="Password" placeholder="Mot de passe" required />
            <label for="ConfirmPassword" class="form-label">Confirmation</label>
            <input class="form-control MatchedInput" type="password" name="ConfirmPassword" id="ConfirmPassword" placeholder="Confirmation" matchedInputId="Password" required />
            <label class="form-label">Avatar</label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='false' 
                     controlId='Avatar' 
                     imageSrc='news-logo.png' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div class="formButton">
                <button type="submit" class="btn btn-primary w-100" id="saveAccount">Creer mon compte</button>
            </div>
        </form>
    `);
    initImageUploaders();
    initFormValidation();
    addConflictValidation(Accounts_API.conflictURL(), "Email", "saveAccount");
    $('#registerForm').on("submit", async function (event) {
        event.preventDefault();
        let account = getFormData($("#registerForm"));
        let result = await Accounts_API.register(account);
        if (!Accounts_API.error && result) {
            verifyingUserId = result.Id;
            popupMessage("Compte cree. Consultez vos courriels pour le code de verification.");
            showVerifyForm(verifyingUserId, result.Email);
        } else {
            let message = Accounts_API.currentHttpError;
            if (Accounts_API.currentStatus == 409) message = "Courriel deja utilise";
            $("#formError").text(message);
            $("#formError").show();
        }
    });
}
function showVerifyForm(userId = null, email = "") {
    verifyingUserId = userId;
    showForm("Verification de courriel");
    $('#commit').hide();
    $("#form").empty();
    $("#form").append(`
        <form class="form confirmForm" id="verifyForm">
            <div id="formError" class="errorContainer" style="display:none;"></div>
            <p>Entrez le code recu par courriel ${email !== "" ? "(" + email + ")" : ""}.</p>
            <label for="code" class="form-label">Code de verification</label>
            <input class="form-control" name="code" id="code" placeholder="Code" required />
            <div class="formButton">
                <button type="submit" class="btn btn-primary w-100">Valider</button>
            </div>
        </form>
    `);
    $('#verifyForm').on("submit", async function (event) {
        event.preventDefault();
        let code = $("#code").val();
        let result = await Accounts_API.verify(verifyingUserId, code);
        if (!Accounts_API.error && result) {
            popupMessage("Courriel verifie. Vous pouvez vous connecter.");
            showLoginForm();
        } else {
            $("#formError").text("Code invalide");
            $("#formError").show();
        }
    });
}
function showProfileForm() {
    if (!AuthManager.isLoggedIn()) {
        showLoginForm();
        return;
    }
    showForm("Profil");
    $('#commit').hide();
    let user = AuthManager.user;
    $("#form").empty();
    $("#form").append(`
        <form class="form" id="profileForm">
            <div id="formError" class="errorContainer" style="display:none;"></div>
            <input type="hidden" name="Id" value="${user.Id}"/>
            <label for="Name" class="form-label">Nom complet</label>
            <input class="form-control Alpha" name="Name" id="Name" placeholder="Nom" required value="${user.Name}" />
            <label for="Email" class="form-label">Courriel</label>
            <input class="form-control Email" name="Email" id="Email" placeholder="Courriel" required CustomErrorMessage="Ce courriel existe deja" value="${user.Email}" />
            <label for="Password" class="form-label">Mot de passe (laisser vide pour conserver)</label>
            <input class="form-control" type="password" name="Password" id="Password" placeholder="Mot de passe" />
            <label class="form-label">Avatar</label>
            <div class='imageUploaderContainer'>
                <div class='imageUploader' 
                     newImage='false' 
                     controlId='Avatar' 
                     imageSrc='${user.Avatar}' 
                     waitingImage="Loading_icon.gif">
                </div>
            </div>
            <div class="formButton">
                <button type="submit" class="btn btn-primary w-100" id="saveProfile">Enregistrer</button>
            </div>
            <div class="formButton">
                <button type="button" class="btn btn-secondary w-100" id="deleteAccount">Supprimer le compte</button>
            </div>
        </form>
    `);
    initImageUploaders();
    initFormValidation();
    addConflictValidation(Accounts_API.conflictURL(), "Email", "saveProfile");
    $('#profileForm').on("submit", async function (event) {
        event.preventDefault();
        let account = getFormData($("#profileForm"));
        account.Id = user.Id;
        let updated = await Accounts_API.modify(account);
        if (!Accounts_API.error && updated) {
            if (updated.VerifyCode && updated.VerifyCode !== "verified") {
                popupMessage("Veuillez verifier votre nouveau courriel.");
                await logout(false);
                showVerifyForm(updated.Id, updated.Email);
            } else {
                AuthManager.setSession({ Access_token: AuthManager.token, User: updated });
                updateDropDownMenu();
                await showPosts(true);
            }
        } else {
            let message = Accounts_API.currentHttpError;
            if (Accounts_API.currentStatus == 409) message = "Courriel deja utilise";
            $("#formError").text(message);
            $("#formError").show();
        }
    });
    $('#deleteAccount').on("click", function () {
        confirmAccountDeletion();
    });
}
async function confirmAccountDeletion() {
    if (!AuthManager.isLoggedIn()) return;
    let confirmDelete = confirm("Supprimer votre compte effacera vos nouvelles et vos likes. Continuer?");
    if (confirmDelete) {
        let success = await Accounts_API.delete(AuthManager.user.Id);
        if (success) {
            await logout(false);
            popupMessage("Compte supprime.");
        } else {
            showError(Accounts_API.currentHttpError);
        }
    }
}
async function showUsersAdmin() {
    if (!AuthManager.isAdmin()) {
        showError("Acces admin requis.");
        return;
    }
    showForm("Gestion des usagers");
    $('#commit').hide();
    $("#form").empty();
    addWaitingGif();
    let users = await Accounts_API.getUsers();
    removeWaitingGif();
    if (Accounts_API.error || users == null) {
        showError(Accounts_API.currentHttpError);
        return;
    }
    let rows = "";
    users.forEach(user => {
        let role = user.isAdmin ? "Admin" : user.isSuper ? "Super" : user.Authorizations.readAccess > 0 ? "Usager" : "Bloque";
        let status = user.VerifyCode !== "verified" ? "Non verifie" : "Actif";
        let blockLabel = user.isBlocked ? "Debloquer" : "Bloquer";
        rows += `
            <tr data-id="${user.Id}">
                <td>${user.Name}</td>
                <td>${user.Email}</td>
                <td>${role}</td>
                <td>${status}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary promoteUser">Permissions</button>
                    <button class="btn btn-sm btn-outline-warning blockUser">${blockLabel}</button>
                    <button class="btn btn-sm btn-outline-danger deleteUser">Supprimer</button>
                </td>
            </tr>
        `;
    });
    $("#form").append(`
        <div class="table-responsive">
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th>Nom</th><th>Courriel</th><th>Role</th><th>Statut</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `);
    $(".promoteUser").on("click", async function () {
        let id = $(this).closest("tr").data("id");
        await Accounts_API.promote(id);
        if (!Accounts_API.error) showUsersAdmin();
        else showError(Accounts_API.currentHttpError);
    });
    $(".blockUser").on("click", async function () {
        let id = $(this).closest("tr").data("id");
        await Accounts_API.toggleBlock(id);
        if (!Accounts_API.error) showUsersAdmin();
        else showError(Accounts_API.currentHttpError);
    });
    $(".deleteUser").on("click", async function () {
        let id = $(this).closest("tr").data("id");
        if (confirm("Supprimer cet usager?")) {
            let ok = await Accounts_API.delete(id);
            if (!ok) showError(Accounts_API.currentHttpError);
            else showUsersAdmin();
        }
    });
}

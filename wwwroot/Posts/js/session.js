function createTimeoutPopup(message = "") {
    if ($(".popup").length) return;
    $('body').append(`
        <div class='popup'> 
            <div class='popupContent'>
                <div>
                    <div class='popupHeader'> Attention!</div> 
                    <h4 id='popUpMessage'>${message}</h4>
                </div>
                <div onclick='closePopup(); ' class='close-btn fa fa-close'></div> 
            </div>
        </div> 
    `);
}

let currentTimeouID = undefined;
let initialized = false;
let timeBeforeRedirect = 5;
let timeoutCallBack = () => { };
let infinite = -1;
let timeLeft = infinite;
let maxStallingTime = infinite;

function popupMessage(message) {
    $(".popup").show();
}

function initTimeout(stallingTime = infinite, callback = timeoutCallBack) {
    maxStallingTime = stallingTime;
    timeoutCallBack = callback;
    createTimeoutPopup();
    initialized = true;
}
function noTimeout() {
    $(".popup").hide();
    clearTimeout(currentTimeouID);
}
function setidleTime(idleTime = 1 * 60) {
    maxStallingTime = idleTime;
    timeout();
}
function timeout() {
    startCountdown();
}
function startCountdown() {
    if (!initialized) initTimeout();
    clearTimeout(currentTimeouID);
    $(".popup").hide();
    timeLeft = maxStallingTime;
    if (timeLeft != infinite) {
        currentTimeouID = setInterval(() => {
            timeLeft = timeLeft - 1;
            if (timeLeft > 0) {
                //console.log('session timeout counting', timeLeft)
                if (timeLeft <= 10) {
                    $(".popup").show();
                    $("#popUpMessage").text("Expiration dans " + timeLeft + " secondes");
                }
            } else {
                closePopup();
                $("#popUpMessage").text('Redirection');
                clearTimeout(currentTimeouID);
                timeoutCallBack();
            }
        }, 1000);
    }
}
function closePopup() {
    $(".popup").hide();
    startCountdown();
} 

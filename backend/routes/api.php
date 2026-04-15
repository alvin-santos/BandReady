<?php

use App\Http\Controllers\Api\Admin\AdminAdController;
use App\Http\Controllers\Api\Admin\AdminContactMessageController;
use App\Http\Controllers\Api\Admin\AdminDatabaseBackupController;
use App\Http\Controllers\Api\Admin\AdminDownloadableController;
use App\Http\Controllers\Api\Admin\AdminExamController;
use App\Http\Controllers\Api\Admin\AdminOpenAiQuestionnaireController;
use App\Http\Controllers\Api\Admin\AdminQuestionBankStatsController;
use App\Http\Controllers\Api\Admin\AdminQuestionController;
use App\Http\Controllers\Api\Admin\AdminBandieTutorSettingsController;
use App\Http\Controllers\Api\Admin\AdminExamNavSettingsController;
use App\Http\Controllers\Api\Admin\AdminRankingSettingsController;
use App\Http\Controllers\Api\Admin\AdminSectionController;
use App\Http\Controllers\Api\Admin\AdminStatsController;
use App\Http\Controllers\Api\Admin\AdminTestController;
use App\Http\Controllers\Api\Admin\AdminTtsVoiceSettingsController;
use App\Http\Controllers\Api\AdPublicController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\BandieTutorSettingsController;
use App\Http\Controllers\Api\AttemptController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContactMessageController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DownloadablePublicController;
use App\Http\Controllers\Api\ExamController;
use App\Http\Controllers\Api\ForumController;
use App\Http\Controllers\Api\IeltsSpeakingAiController;
use App\Http\Controllers\Api\MistakesHubController;
use App\Http\Controllers\Api\PublicRankingController;
use App\Http\Controllers\Api\ResultController;
use App\Http\Controllers\Api\SiteTrafficController;
use App\Http\Controllers\Api\SpeakingTranscriptionController;
use App\Http\Controllers\Api\StripeWebhookController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\TestController;
use App\Http\Controllers\Api\TtsVoiceSettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/exams', [ExamController::class, 'index']);
Route::get('/rankings', [PublicRankingController::class, 'index']);
Route::get('/tests', [TestController::class, 'index']);
Route::get('/tests/{id}', [TestController::class, 'show'])->whereNumber('id');

Route::get('/ads', [AdPublicController::class, 'index']);
Route::post('/ads/{id}/click', [AdPublicController::class, 'click'])->whereNumber('id');

Route::get('/resources', [DownloadablePublicController::class, 'index']);

Route::get('/forum/categories', [ForumController::class, 'categories']);
Route::get('/forum/categories/{id}/threads', [ForumController::class, 'threads'])->whereNumber('id');
Route::get('/forum/threads/{id}', [ForumController::class, 'showThread'])->whereNumber('id');

Route::post('/contact-messages', [ContactMessageController::class, 'store'])
    ->middleware('throttle:10,1');

Route::post('/site-traffic/visit', [SiteTrafficController::class, 'store'])
    ->middleware('throttle:120,1');

Route::post('/subscription/webhook', StripeWebhookController::class)
    ->middleware('throttle:120,1');

Route::get('/tts-voice-settings', [TtsVoiceSettingsController::class, 'publicIndex']);
Route::get('/bandie-tutor-settings', [BandieTutorSettingsController::class, 'publicIndex']);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::post('/start-attempt', [AttemptController::class, 'start']);
Route::get('/attempts/{id}/resume', [AttemptController::class, 'resume'])->whereNumber('id');
Route::post('/save-answer', [AttemptController::class, 'saveAnswer']);
Route::post('/speaking/transcribe', [SpeakingTranscriptionController::class, 'transcribe'])
    ->middleware(['auth:sanctum', 'throttle:speaking-transcribe']);
Route::middleware(['auth:sanctum'])->group(function () {
    Route::post('/speaking/ielts-ai/start', [IeltsSpeakingAiController::class, 'start'])
        ->middleware('throttle:ielts-ai-start');
    Route::post('/speaking/ielts-ai/step', [IeltsSpeakingAiController::class, 'step'])
        ->middleware('throttle:ielts-ai-step');
});
Route::post('/attempts/{id}/forward-only', [AttemptController::class, 'advanceForwardOnly'])->whereNumber('id');
Route::post('/submit-attempt', [AttemptController::class, 'submit']);
Route::get('/results/{id}', [ResultController::class, 'show'])->whereNumber('id');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/email/resend-verification', [AuthController::class, 'resendVerificationEmail'])
        ->middleware('throttle:6,1');
    /** Pricing / Stripe flags — any signed-in user (verified not required). */
    Route::get('/subscription/offer', [SubscriptionController::class, 'offer']);
});

Route::middleware(['auth:sanctum', 'verified'])->group(function () {
    Route::get('/analytics', [AnalyticsController::class, 'index']);
    Route::get('/dashboard', [DashboardController::class, 'summary']);
    Route::get('/profile/stats', [DashboardController::class, 'profileStats']);
    Route::get('/attempts/active', [AttemptController::class, 'active']);
    Route::post('/subscription/checkout-session', [SubscriptionController::class, 'createCheckoutSession'])
        ->middleware('throttle:12,1');
    Route::post('/subscription/verify-checkout-session', [SubscriptionController::class, 'verifyCheckoutSession'])
        ->middleware('throttle:30,1');
    Route::post('/subscription/simulate-checkout', [SubscriptionController::class, 'simulateCheckout']);
    Route::get('/mistakes/hub', [MistakesHubController::class, 'show']);
    Route::get('/resources/{slug}/download', [DownloadablePublicController::class, 'download'])->where('slug', '[a-z0-9-]+');

    Route::post('/forum/categories/{id}/threads', [ForumController::class, 'storeThread'])
        ->whereNumber('id')
        ->middleware('throttle:20,1');
    Route::post('/forum/threads/{id}/replies', [ForumController::class, 'storeReply'])
        ->whereNumber('id')
        ->middleware('throttle:40,1');
});

Route::middleware(['auth:sanctum', 'verified', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminStatsController::class, 'dashboard']);
    Route::get('/stats/charts', [AdminStatsController::class, 'charts']);
    Route::get('/stats/exam-popularity', [AdminStatsController::class, 'examPopularity']);

    Route::get('/exams', [AdminExamController::class, 'index']);
    Route::post('/exams', [AdminExamController::class, 'store']);
    Route::put('/exams/{id}', [AdminExamController::class, 'update'])->whereNumber('id');
    Route::delete('/exams/{id}', [AdminExamController::class, 'destroy'])->whereNumber('id');

    Route::get('/sections', [AdminSectionController::class, 'index']);
    Route::post('/sections', [AdminSectionController::class, 'store']);
    Route::put('/sections/{id}', [AdminSectionController::class, 'update'])->whereNumber('id');
    Route::delete('/sections/{id}', [AdminSectionController::class, 'destroy'])->whereNumber('id');

    Route::get('/tests', [AdminTestController::class, 'index']);
    Route::post('/tests', [AdminTestController::class, 'store']);
    Route::put('/tests/{id}', [AdminTestController::class, 'update'])->whereNumber('id');
    Route::delete('/tests/{id}', [AdminTestController::class, 'destroy'])->whereNumber('id');

    Route::get('/openai-questionnaire/extra-prompts', [AdminOpenAiQuestionnaireController::class, 'extraPromptsIndex']);
    Route::post('/openai-questionnaire/extra-prompts', [AdminOpenAiQuestionnaireController::class, 'extraPromptsStore']);
    Route::delete('/openai-questionnaire/extra-prompts/{id}', [AdminOpenAiQuestionnaireController::class, 'extraPromptsDestroy'])
        ->whereNumber('id');
    Route::post('/openai-questionnaire/run', [AdminOpenAiQuestionnaireController::class, 'run']);

    Route::get('/question-bank-stats', [AdminQuestionBankStatsController::class, 'index']);

    Route::get('/questions', [AdminQuestionController::class, 'index']);
    Route::post('/questions/import', [AdminQuestionController::class, 'import']);
    Route::post('/questions', [AdminQuestionController::class, 'store']);
    Route::put('/questions/{id}', [AdminQuestionController::class, 'update'])->whereNumber('id');
    Route::post('/questions/{id}/generate-speaking-image', [AdminQuestionController::class, 'generateSpeakingImage'])
        ->whereNumber('id');
    Route::post('/questions/{id}/clear-speaking-image', [AdminQuestionController::class, 'clearSpeakingImage'])
        ->whereNumber('id');
    Route::delete('/questions/{id}', [AdminQuestionController::class, 'destroy'])->whereNumber('id');

    Route::get('/ads', [AdminAdController::class, 'index']);
    Route::post('/ads', [AdminAdController::class, 'store']);
    Route::put('/ads/{id}', [AdminAdController::class, 'update'])->whereNumber('id');
    Route::delete('/ads/{id}', [AdminAdController::class, 'destroy'])->whereNumber('id');

    Route::get('/ranking-settings', [AdminRankingSettingsController::class, 'show']);
    Route::put('/ranking-settings', [AdminRankingSettingsController::class, 'update']);

    Route::get('/bandie-tutor-settings', [AdminBandieTutorSettingsController::class, 'show']);
    Route::put('/bandie-tutor-settings', [AdminBandieTutorSettingsController::class, 'update']);

    Route::get('/exam-nav-settings', [AdminExamNavSettingsController::class, 'show']);
    Route::put('/exam-nav-settings', [AdminExamNavSettingsController::class, 'update']);

    Route::get('/tts-voice-settings', [AdminTtsVoiceSettingsController::class, 'show']);
    Route::put('/tts-voice-settings', [AdminTtsVoiceSettingsController::class, 'update']);

    Route::get('/downloadables', [AdminDownloadableController::class, 'index']);
    Route::post('/downloadables', [AdminDownloadableController::class, 'store']);
    Route::put('/downloadables/{id}', [AdminDownloadableController::class, 'update'])->whereNumber('id');
    Route::delete('/downloadables/{id}', [AdminDownloadableController::class, 'destroy'])->whereNumber('id');

    Route::get('/contact-messages', [AdminContactMessageController::class, 'index']);
    Route::post('/contact-messages/{id}/read', [AdminContactMessageController::class, 'markRead'])->whereNumber('id');
    Route::post('/contact-messages/{id}/unread', [AdminContactMessageController::class, 'markUnread'])->whereNumber('id');

    Route::get('/database-backups', [AdminDatabaseBackupController::class, 'index']);
    Route::get('/database-backups/download-url', [AdminDatabaseBackupController::class, 'downloadUrl'])
        ->middleware('throttle:60,1');
    Route::post('/database-backups/run', [AdminDatabaseBackupController::class, 'run'])
        ->middleware('throttle:5,1');
});

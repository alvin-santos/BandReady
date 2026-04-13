<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->unsignedTinyInteger('celpip_task_number')->nullable()->after('order');
            $table->string('celpip_task_label', 191)->nullable()->after('celpip_task_number');
        });
    }

    public function down(): void
    {
        Schema::table('questions', function (Blueprint $table) {
            $table->dropColumn(['celpip_task_number', 'celpip_task_label']);
        });
    }
};

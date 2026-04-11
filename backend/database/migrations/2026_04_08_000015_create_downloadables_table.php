<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('downloadables', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('requires_pro')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->longText('body_text');
            $table->string('download_filename')->default('document.txt');
            $table->string('mime_type')->default('text/plain');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('downloadables');
    }
};

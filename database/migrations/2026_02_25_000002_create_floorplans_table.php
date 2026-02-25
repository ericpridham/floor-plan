<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('floorplans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('image_path');
            $table->unsignedInteger('width_px');
            $table->unsignedInteger('height_px');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('floorplans');
    }
};

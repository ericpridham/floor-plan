<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Room extends Model
{
    use HasFactory;

    protected $fillable = ['floorplan_id', 'name', 'x', 'y', 'width', 'height', 'vertices'];

    protected $casts = [
        'x'        => 'float',
        'y'        => 'float',
        'width'    => 'float',
        'height'   => 'float',
        'vertices' => 'array',
    ];

    public function floorplan(): BelongsTo
    {
        return $this->belongsTo(Floorplan::class);
    }
}

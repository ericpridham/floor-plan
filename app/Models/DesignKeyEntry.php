<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignKeyEntry extends Model
{
    use HasFactory;
    protected $fillable = ['design_id', 'color_hex', 'label', 'sort_order'];

    public function design(): BelongsTo
    {
        return $this->belongsTo(Design::class);
    }
}

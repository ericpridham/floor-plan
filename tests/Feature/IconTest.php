<?php

namespace Tests\Feature;

use App\Models\Design;
use App\Models\DesignIcon;
use App\Models\Floorplan;
use App\Models\IconLibrary;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class IconTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(): User
    {
        return User::factory()->create();
    }

    private function makeDesign(int $userId): Design
    {
        return Design::create(['user_id' => $userId, 'name' => 'Test Design']);
    }

    private function makeBuiltInIcon(): IconLibrary
    {
        return IconLibrary::create([
            'user_id'  => null,
            'category' => 'Furniture',
            'label'    => 'Chair',
            'svg_path' => '/icons/furniture/chair.svg',
        ]);
    }

    private function makeSvgUploadedFile(): UploadedFile
    {
        $svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>';
        $tmpPath = tempnam(sys_get_temp_dir(), 'icon_') . '.svg';
        file_put_contents($tmpPath, $svgContent);

        return new UploadedFile($tmpPath, 'icon.svg', 'image/svg+xml', null, true);
    }

    // 1. test_icon_index_requires_auth
    public function test_icon_index_requires_auth(): void
    {
        $this->get(route('api.icons.index'))
             ->assertRedirect(route('login'));
    }

    // 2. test_icon_index_returns_built_in_and_custom_icons
    public function test_icon_index_returns_built_in_and_custom_icons(): void
    {
        $user = $this->makeUser();

        $builtIn = $this->makeBuiltInIcon();

        $custom = IconLibrary::create([
            'user_id'  => $user->id,
            'category' => 'My Things',
            'label'    => 'My Icon',
            'svg_path' => '/storage/icons/1/test.svg',
        ]);

        $otherUser = $this->makeUser();
        IconLibrary::create([
            'user_id'  => $otherUser->id,
            'category' => 'Other',
            'label'    => 'Their Icon',
            'svg_path' => '/storage/icons/2/test.svg',
        ]);

        $response = $this->actingAs($user)
                         ->getJson(route('api.icons.index'));

        $response->assertOk()
                 ->assertJsonStructure(['built_in', 'custom'])
                 ->assertJsonFragment(['label' => 'Chair'])
                 ->assertJsonFragment(['label' => 'My Icon']);

        $responseData = $response->json();
        $customLabels = array_column($responseData['custom'], 'label');
        $this->assertContains('My Icon', $customLabels);
        $this->assertNotContains('Their Icon', $customLabels);
    }

    // 3. test_user_can_upload_custom_icon
    public function test_user_can_upload_custom_icon(): void
    {
        Storage::fake('public');
        $user = $this->makeUser();
        $file = $this->makeSvgUploadedFile();

        $response = $this->actingAs($user)
                         ->withHeader('Accept', 'application/json')
                         ->post(route('api.icons.store'), [
                             'label'    => 'My Custom Chair',
                             'category' => 'Custom Furniture',
                             'icon'     => $file,
                         ]);

        $response->assertCreated()
                 ->assertJsonFragment(['label' => 'My Custom Chair'])
                 ->assertJsonFragment(['category' => 'Custom Furniture'])
                 ->assertJsonStructure(['url']);

        $this->assertDatabaseHas('icon_libraries', [
            'user_id'  => $user->id,
            'label'    => 'My Custom Chair',
            'category' => 'Custom Furniture',
        ]);
    }

    // 4. test_upload_validates_file_type
    public function test_upload_validates_file_type(): void
    {
        Storage::fake('public');
        $user = $this->makeUser();
        $file = UploadedFile::fake()->create('icon.txt', 10, 'text/plain');

        $this->actingAs($user)
             ->withHeader('Accept', 'application/json')
             ->post(route('api.icons.store'), [
                 'label'    => 'Bad Icon',
                 'category' => 'Test',
                 'icon'     => $file,
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['icon']);
    }

    // 5. test_upload_validates_max_size
    public function test_upload_validates_max_size(): void
    {
        Storage::fake('public');
        $user = $this->makeUser();
        // 1025 KB > 1024 KB limit
        $file = UploadedFile::fake()->create('big.png', 1025, 'image/png');

        $this->actingAs($user)
             ->withHeader('Accept', 'application/json')
             ->post(route('api.icons.store'), [
                 'label'    => 'Big Icon',
                 'category' => 'Test',
                 'icon'     => $file,
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['icon']);
    }

    // 6. test_user_can_delete_own_icon
    public function test_user_can_delete_own_icon(): void
    {
        Storage::fake('public');
        $user = $this->makeUser();

        $storedPath = 'icons/' . $user->id . '/test.svg';
        Storage::disk('public')->put($storedPath, '<svg/>');

        $icon = IconLibrary::create([
            'user_id'  => $user->id,
            'category' => 'Test',
            'label'    => 'Deletable',
            'svg_path' => $storedPath,
        ]);

        $this->actingAs($user)
             ->deleteJson(route('api.icons.destroy', $icon))
             ->assertOk()
             ->assertJson(['deleted' => true]);

        $this->assertDatabaseMissing('icon_libraries', ['id' => $icon->id]);
        Storage::disk('public')->assertMissing($storedPath);
    }

    // 7. test_delete_forbidden_for_non_owner
    public function test_delete_forbidden_for_non_owner(): void
    {
        Storage::fake('public');
        $owner = $this->makeUser();
        $other = $this->makeUser();

        $icon = IconLibrary::create([
            'user_id'  => $owner->id,
            'category' => 'Test',
            'label'    => 'Owner Icon',
            'svg_path' => '/storage/icons/1/test.svg',
        ]);

        $this->actingAs($other)
             ->deleteJson(route('api.icons.destroy', $icon))
             ->assertForbidden();

        $this->assertDatabaseHas('icon_libraries', ['id' => $icon->id]);
    }

    // 8. test_sync_icons_saves_icons
    public function test_sync_icons_saves_icons(): void
    {
        $user   = $this->makeUser();
        $design = $this->makeDesign($user->id);
        $icon   = $this->makeBuiltInIcon();

        $payload = [
            'icons' => [
                [
                    'icon_library_id' => $icon->id,
                    'x'               => 48.0,
                    'y'               => 72.0,
                    'width'           => 48.0,
                    'height'          => 48.0,
                    'rotation'        => 0.0,
                    'is_free_placed'  => false,
                    'z_order'         => 0,
                ],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.icons', $design), $payload)
             ->assertOk()
             ->assertJson(['saved' => true]);

        $this->assertDatabaseHas('design_icons', [
            'design_id'       => $design->id,
            'icon_library_id' => $icon->id,
            'z_order'         => 0,
        ]);
    }

    // 9. test_sync_icons_forbidden_for_non_owner
    public function test_sync_icons_forbidden_for_non_owner(): void
    {
        $owner  = $this->makeUser();
        $other  = $this->makeUser();
        $design = $this->makeDesign($owner->id);
        $icon   = $this->makeBuiltInIcon();

        $payload = [
            'icons' => [
                [
                    'icon_library_id' => $icon->id,
                    'x'               => 0.0,
                    'y'               => 0.0,
                    'width'           => 48.0,
                    'height'          => 48.0,
                    'rotation'        => 0.0,
                    'is_free_placed'  => false,
                    'z_order'         => 0,
                ],
            ],
        ];

        $this->actingAs($other)
             ->putJson(route('api.designs.icons', $design), $payload)
             ->assertForbidden();
    }

    // 11. test_sync_icons_rejects_another_users_custom_icon
    public function test_sync_icons_rejects_another_users_custom_icon(): void
    {
        $userA  = $this->makeUser();
        $userB  = $this->makeUser();

        $iconA = IconLibrary::create([
            'user_id'  => $userA->id,
            'category' => 'Custom',
            'label'    => 'User A Icon',
            'svg_path' => 'icons/' . $userA->id . '/some.svg',
        ]);

        $design = $this->makeDesign($userB->id);

        $payload = [
            'icons' => [
                [
                    'icon_library_id' => $iconA->id,
                    'x'               => 0.0,
                    'y'               => 0.0,
                    'width'           => 48.0,
                    'height'          => 48.0,
                    'rotation'        => 0.0,
                    'is_free_placed'  => false,
                    'z_order'         => 0,
                ],
            ],
        ];

        $this->actingAs($userB)
             ->putJson(route('api.designs.icons', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['icons.0.icon_library_id']);
    }

    // 10. test_sync_icons_validates_icon_exists
    public function test_sync_icons_validates_icon_exists(): void
    {
        $user   = $this->makeUser();
        $design = $this->makeDesign($user->id);

        $payload = [
            'icons' => [
                [
                    'icon_library_id' => 99999,
                    'x'               => 0.0,
                    'y'               => 0.0,
                    'width'           => 48.0,
                    'height'          => 48.0,
                    'rotation'        => 0.0,
                    'is_free_placed'  => false,
                    'z_order'         => 0,
                ],
            ],
        ];

        $this->actingAs($user)
             ->putJson(route('api.designs.icons', $design), $payload)
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['icons.0.icon_library_id']);
    }
}

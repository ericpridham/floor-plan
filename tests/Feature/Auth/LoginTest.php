<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_form_is_accessible(): void
    {
        $response = $this->withoutVite()->get('/login');

        $response->assertStatus(200);
    }

    public function test_user_can_login_with_correct_credentials(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);

        $response = $this->post('/login', [
            'email' => 'user@example.com',
            'password' => 'password',
        ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect(route('dashboard'));
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'user@example.com']);

        $response = $this->post('/login', [
            'email' => 'user@example.com',
            'password' => 'wrongpassword',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors('email');
    }

    public function test_login_fails_with_nonexistent_email(): void
    {
        $response = $this->post('/login', [
            'email' => 'nobody@example.com',
            'password' => 'password123',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors('email');
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect(route('login'));
    }

    public function test_guest_is_redirected_from_dashboard(): void
    {
        $response = $this->get('/dashboard');

        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_access_dashboard(): void
    {
        $user = User::factory()->create();

        $response = $this->withoutVite()->actingAs($user)->get('/dashboard');

        $response->assertStatus(200);
    }

    public function test_authenticated_user_is_redirected_from_login_form(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/login');

        $response->assertRedirect(route('dashboard'));
    }

    public function test_authenticated_user_is_redirected_from_register_form(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->get('/register');

        $response->assertRedirect(route('dashboard'));
    }
}

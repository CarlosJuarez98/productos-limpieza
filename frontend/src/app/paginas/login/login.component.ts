import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { ClearableDirective } from '../../clearable.directive';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ClearableDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  cargando = false;
  sesionActual: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.auth.me().subscribe((m) => {
      this.sesionActual = m.authenticated ? m.username || null : null;
    });
  }

  enviar(): void {
    this.error = '';
    const u = this.username.trim();
    if (!u || !this.password) {
      this.error = 'Escribe usuario y contraseña';
      return;
    }
    this.cargando = true;
    this.auth.login(u, this.password).subscribe({
      next: () => {
        this.cargando = false;
        void this.router.navigateByUrl('/ventas');
      },
      error: (err) => {
        this.cargando = false;
        const body = err?.error;
        const msg =
          (typeof body === 'string' ? body : null) ||
          body?.message ||
          body?.error ||
          err?.message;
        this.error =
          typeof msg === 'string' && /incorrectos|contraseña|Unauthorized|401/i.test(msg)
            ? 'Usuario o contraseña incorrectos'
            : typeof msg === 'string' && msg.length < 120 && !msg.startsWith('Http')
              ? msg
              : 'Usuario o contraseña incorrectos';
      },
    });
  }
}

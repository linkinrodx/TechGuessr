import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from './shared/components/app-header/app-header';
import { AnimatedBackground } from './shared/components/animated-background/animated-background';
import { Mascot } from './shared/components/mascot/mascot';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader, AnimatedBackground, Mascot],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}

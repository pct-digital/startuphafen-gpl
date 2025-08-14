import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'sh-portal-footer',
  templateUrl: './portal-footer.component.html',
  styles: `
  :host {
    display: block;
  }

  .footer-image-container {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 700px;
    max-width: 30%;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -170px; 
      height: 200%; 
      width: 240px; 
      background-color: var(--sh-color-primary);
      clip-path: polygon(0 0, 100% 0, 50% 100%, 0 100%); 
      z-index: 10;
      transform: rotate(-10deg);
    }
  }

  .image-wrapper {
    position: relative;
    height: 100%;
    width: 100%;
    background-color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 10px;
  }

  .footer-logo {
    max-width: 100%;
    height: auto;
    max-height: 90%;
    object-fit: contain;
  }

  @media (max-width: 1023px) {
    .footer-image-container {
      position: relative;
      width: 100%;
      max-width: 100%;
      height: auto;
      margin-top: 20px;
      
      &::before {
        display: none; 
      }
    }
    
    .image-wrapper {
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
  }
  `,
  standalone: true,
  imports: [CommonModule],
})
export class PortalFooterComponent {
  constructor() {}

  readonly impressumExternalLink: string =
    'https://www.startuphafen.sh/Service/Impressum/';
  readonly datenschutzExternalLink: string =
    'https://www.startuphafen.sh/Service/Datenschutz/';
  readonly barrierefreiheitExternalLink: string =
    'https://www.startuphafen.sh/Service/Barrierefreiheit/';
  readonly startSeiteExternalLink: string = 'https://www.startuphafen.sh/';
  readonly kontaktExternalLink: string = 'https://www.startuphafen.sh/Kontakt/';
}

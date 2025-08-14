import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';

@Component({
  selector: 'sh-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sh-tooltip.component.html',
  styles: `
.tooltip {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.tooltip .tooltiptext {
  visibility: hidden;
  min-width: 120px; 
  max-width: 500px;
  width: max-content; 
  background-color: var(--sh-color-tertiary);
  color: white;
  text-align: center;
  text-wrap: wrap;
  padding: 5px 10px; 
  border-radius: 6px;
  
  position: absolute;
  z-index: 100;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%); 
  margin-left: -150px; 
  
  opacity: 0;
  transition: opacity 0.3s;

  //mobile styles
  @media only screen and (max-width: 768px) {
    min-width: 120px; 
    max-width: 300px;
    transform: translateX(-47%);
  }
}

.tooltip .tooltiptext::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: 150px; 
  transform: translateX(-50%);
  border-width: 5px;
  border-style: solid;
  border-color: var(--sh-color-tertiary) transparent transparent transparent;

  //mobile styles
  @media only screen and (max-width: 768px) {
   left: 47%;
  }
}

@media only screen and (min-width: 769px) {
  .tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
  }
}

@media only screen and (max-width: 768px) {
  .tooltip .tooltiptext.mobile-visible {
    visibility: visible;
    opacity: 1;
  }
}
  `,
})
export class ShTooltipComponent implements OnInit, OnDestroy {
  @Input() content = '';

  isTooltipVisible = false;
  isMobile = false;

  constructor() {}

  ngOnInit(): void {
    this.checkIfMobile();
    window.addEventListener('resize', this.checkIfMobile.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkIfMobile.bind(this));
  }

  private checkIfMobile(): void {
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;
  }

  onTooltipClick(event: Event): void {
    if (this.isMobile) {
      event.stopPropagation();
      this.isTooltipVisible = !this.isTooltipVisible;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(_event: Event): void {
    if (this.isMobile && this.isTooltipVisible) {
      this.isTooltipVisible = false;
    }
  }
}

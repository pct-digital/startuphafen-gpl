import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ShButtonDirective,
  ShCardContentDirective,
  ShCardDirective,
  ShCardTitleDirective,
  TrpcService,
} from '@startuphafen/angular-common';
import {
  FinanzaemterSchema,
  JurisdictionSchema,
} from '@startuphafen/startuphafen-common';

@Component({
  selector: 'sh-send-application',
  standalone: true,
  imports: [
    CommonModule,
    ShButtonDirective,
    ShCardDirective,
    ShCardTitleDirective,
    ShCardContentDirective,
    FormsModule,
  ],
  templateUrl: './send-application.component.html',
  styles: `

  @media screen and (max-width: 768px) {
    .error-mobile{
      transform: scale(1);
    }
    .acrylic{
    background-color: rgba(255, 255, 255,0.9);
    backdrop-filter: blur(10px);
  }
  }
@media screen and (min-width: 769px) {
  .acrylic{
    background-color: rgba(255, 255, 255,0.7);
    backdrop-filter: blur(10px);
  }
}
  
  .filter-green{
    filter: invert(89%) sepia(30%) saturate(5792%) hue-rotate(61deg) brightness(83%) contrast(82%);
}
  `,
})
export class SendApplicationComponent implements OnInit {
  private trpc = inject(TrpcService);

  @Input() applicationType: 'elster' | 'gewerbeamt' | 'hwk' | null = null;
  @Input() sendDisabled = false;
  @Input() sent = false;
  @Input() lockSend = false;
  @Input() downloadDisabled = false;
  @Input() downloadVisible = true;
  @Input() catalogueId: string | null = null;

  @Input() content: string | null = null;
  @Input() title: string | null = null;
  @Input() subtitle: string | null = null;
  @Input() errorCardTitle: string | null = null;
  @Input() errorMessage: string[] | null = null;

  @Input() sendButtonText: string | null = null;


  @Output() sendData = new EventEmitter<number | null>();
  @Output() downloadData = new EventEmitter<void>();

  bufaNrSelected: number | null = null;

  finanzaemter: FinanzaemterSchema = [];
  async ngOnInit() {
    if (
      this.catalogueId != null &&
      ['eun', 'kapg'].includes(this.catalogueId)
    ) {
      const catId: JurisdictionSchema = this.catalogueId as JurisdictionSchema;
      this.finanzaemter = await this.trpc.client.Ext.getFinanzaemter.query();
      this.finanzaemter = this.finanzaemter.filter(
        (e) => e.jurisdiction.includes(catId) || e.jurisdiction.includes('all')
      );
    }
  }

  clickSend() {
    this.sendData.emit(this.bufaNrSelected);
  }

  clickDownloadData() {
    this.downloadData.emit();
  }
}
